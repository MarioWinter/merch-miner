/**
 * Chat SSE streaming hook.
 *
 * FIX (chat-bugfixes-and-grouping, Item 1) — 2026-05-28:
 * Replaces the previous `new EventSource(GET)` implementation with a
 * `fetch(POST)` + manual SSE parser over `response.body.getReader()`.
 *
 * Why: Caddy on prod caps request URI length at ~8 KB. URL-encoded German
 * prompts of ~4 KB already exceed it (Caddy returns 400 BEFORE CORS headers,
 * the user sees a CORS error in DevTools). POST puts the prompt in the body
 * — no URI cap.
 *
 * The SSE wire format on the response is identical (`event: foo\ndata: {...}\n\n`);
 * we just parse it manually here instead of letting the browser parse it.
 *
 * Events handled (matches backend StreamingHttpResponse):
 *   init    → setStreamingAssistantMessage({id, sources: [], content: ''})
 *   sources → appendStreamingSources([...WebSearchResult])
 *   chunk   → buffer + rAF-batched appendStreamingChunk(text)
 *   stage / heartbeat / tool_call / tool_result / tool_timeout / chunks_used
 *           / generate_slogans_payload / follow_ups → Redux dispatch 1:1
 *   done    → clearStreamingMessage + RTK Query tag invalidation + onDone(message_id)
 *   error   → close + clear + notistack error
 *
 * EC-7: starting a new stream cancels any active stream (AbortController.abort).
 *
 * Memory hygiene:
 *   - Chunks are buffered and dispatched once per animation frame (~16ms)
 *     instead of one Redux action per SSE event. Drops Redux DevTools
 *     history bloat from ~100 actions/answer to ~5–10.
 *   - A module-scoped singleton AbortController tracks the currently-active
 *     stream across all hook instances (FloatingChatBar + ChatPanel both call
 *     this hook). Starting a new stream from any caller aborts the previous
 *     one, preventing two concurrent streams from corrupting Redux content.
 *
 * 401 handling: fetch() bypasses the axios interceptor, so the hook checks
 * `response.status === 401` BEFORE entering the SSE parse loop and
 * replicates the terminal interceptor behavior (clearAuth + redirect to
 * /login). Mid-stream 401 (rare — token expires while streaming) surfaces
 * as a network error and falls through the existing `connectionLost` path.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/hooks';
import {
  setStreamingAssistantMessage,
  appendStreamingChunk,
  appendStreamingSources,
  clearStreamingMessage,
  pushStreamingStage,
  markStageDone,
  markStageWarning,
  markStageError,
  appendChunksUsed,
  setFollowUps,
  setStreamingSloganPayload,
  promoteStreamingSloganPayload,
  downgradeTimeoutWarningsOnDone,
  selectSearchMode,
  type SearchMode,
} from '@/store/chatBarSlice';
import { clearAuth } from '@/store/authSlice';
import { searchApi } from '@/store/searchSlice';
import type {
  ModeOverride,
  SSEInitEvent,
  SSESourcesEvent,
  SSEChunkEvent,
  SSEDoneEvent,
  SSEErrorEvent,
} from '@/types/search';
import type {
  SSEStageEvent,
  SSEToolCallEvent,
  SSEToolResultEvent,
  SSEToolTimeoutEvent,
  SSEChunksUsedEvent,
  SSEFollowUpsEvent,
  SSEGenerateSlogansPayloadEvent,
} from '@/types/chat-rag';

interface UseSendMessageStreamOptions {
  sessionId: string | null;
  /** Called once the stream completes successfully with the persisted message id. */
  onDone?: (messageId: string) => void;
  /**
   * Called whenever the stream ends in any non-success state — SSE error event,
   * connection-level error, or silence timeout. Consumers use this to release
   * UI flags (e.g. `searching`) that would otherwise stay locked because
   * `onDone` never fires. The hook still surfaces a notistack snackbar.
   */
  onError?: () => void;
}

interface StartArgs {
  content: string;
  mode_override?: ModeOverride;
  niche_id?: string | null;
  /** Optional override — useful right after creating a session when the
   *  hook's bound sessionId hasn't propagated yet. */
  sessionIdOverride?: string;
  /** PROJ-20 Phase 7 — image attachment ids returned by the upload endpoint.
   *  When present the backend routes through the Vision path (OpenRouter
   *  direct) instead of Vane. */
  attachment_ids?: string[];
  /** OpenRouter model id (e.g. `openai/gpt-4.1-mini`). Forwarded to the
   *  stream endpoint, which passes it to Vane via `chatModel`. Without this
   *  Vane silently falls back to its first registered chat model — i.e.
   *  the user's model selection has no effect on the answer. */
  model?: string | null;
}

interface UseSendMessageStreamReturn {
  start: (args: StartArgs) => void;
  stop: () => void;
  isStreaming: boolean;
}

/**
 * Build the POST stream URL. Body is the JSON payload; `optimization_mode`
 * is duplicated as a query param (FIX-dashboard-bug-report-and-polish Item 9)
 * so the backend can read it from the URL even if a future migration moves
 * the chat stream back to GET/EventSource.
 *
 * `apiBase` mirrors the original buildStreamUrl logic: on prod the frontend
 * lives on a different subdomain than the API, so we need `VITE_API_URL`
 * for absolute targeting. In dev the empty string keeps it relative and the
 * Vite proxy handles routing.
 */
const buildStreamUrl = (sessionId: string, searchMode?: SearchMode): string => {
  const apiBase = import.meta.env.VITE_API_URL ?? '';
  const base = `${apiBase}/api/chat/sessions/${sessionId}/messages/stream/`;
  if (!searchMode) return base;
  const params = new URLSearchParams({ optimization_mode: searchMode });
  return `${base}?${params.toString()}`;
};

interface StreamRequestBody {
  content: string;
  mode_override?: ModeOverride;
  niche_id?: string;
  attachment_ids?: string[];
  model?: string;
  /** FIX-dashboard-bug-report-and-polish Item 9 — Vane optimization mode. */
  optimization_mode?: SearchMode;
}

/** Build the JSON body matching `ChatStreamRequestSerializer` on the backend. */
const buildRequestBody = (args: StartArgs, searchMode?: SearchMode): StreamRequestBody => {
  const body: StreamRequestBody = { content: args.content };
  if (args.mode_override) body.mode_override = args.mode_override;
  if (args.niche_id) body.niche_id = args.niche_id;
  if (args.attachment_ids && args.attachment_ids.length > 0) {
    body.attachment_ids = args.attachment_ids;
  }
  if (args.model) body.model = args.model;
  if (searchMode) body.optimization_mode = searchMode;
  return body;
};

// Cleanup 2026-04-28: silent-failure timeout. If no SSE event arrives within
// this window, treat the stream as broken — close it and surface an error.
// Long-running Vane queries can take 20-30s; 60s is a generous deadline.
const STREAM_SILENCE_TIMEOUT_MS = 60_000;

const parseEventData = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/**
 * Read an SSE response body and dispatch `(event, data)` pairs.
 *
 * Wire format per SSE spec: each record ends in `\n\n`. Inside a record,
 * lines starting with `event: ` carry the event name, `data: ` carry the
 * payload. Multi-line `data: ` is concatenated with `\n`. Lines starting
 * with `:` are comments (heartbeat colons) and skipped.
 *
 * Exits cleanly on `AbortError`; rethrows any other error so the hook's
 * outer try/catch can run the connection-lost path.
 */
const parseSSEStream = async (
  response: Response,
  dispatchEvent: (eventName: string, data: string) => void,
): Promise<void> => {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Process every complete `\n\n`-terminated record in the buffer.
      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const record = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        let eventName = 'message';
        const dataLines: string[] = [];
        for (const line of record.split('\n')) {
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).replace(/^ /, ''));
          }
        }
        if (dataLines.length > 0) {
          dispatchEvent(eventName, dataLines.join('\n'));
        }
        boundary = buffer.indexOf('\n\n');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return; // intentional cancel — caller already cleaned up.
    }
    throw err;
  }
};

// Module-scoped singleton — the only AbortController that should be active
// at any time across all useSendMessageStream consumers. Aborting this on
// every new start() prevents Bar + ChatPanel race conditions where two
// streams could otherwise dispatch chunks into the same Redux slice
// concurrently.
let activeAbortController: AbortController | null = null;

export const useSendMessageStream = ({
  sessionId,
  onDone,
  onError,
}: UseSendMessageStreamOptions): UseSendMessageStreamReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );
  const activeWorkspaceId = useAppSelector(
    (s) => s.workspace.activeWorkspaceId,
  );
  // FIX-dashboard-bug-report-and-polish Item 9 — forward the per-user Vane
  // optimization-mode preference. Backend defaults to 'speed' when omitted.
  const searchMode = useAppSelector(selectSearchMode);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isStreamingRef = useRef(false);
  // rAF chunk-batching: buffer text between frames, dispatch once per frame.
  const chunkBufferRef = useRef('');
  const rafIdRef = useRef<number | null>(null);
  // Separate boolean guard from rAF id — protects against sync rAF mocks
  // (used in tests) where the id assignment races with the callback.
  const flushScheduledRef = useRef(false);
  // Cleanup 2026-04-28: silence-watchdog. Reset on every event; if it fires,
  // the stream is stuck (e.g. Vane returned init then hung) — close + error.
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // FIX-chat-bugfixes-and-grouping Item 2 — per-session dedupe set for the
  // info-variant `web_search_unavailable` snackbar. Tracks every session id
  // that has already triggered the info snackbar within this hook instance.
  // Reset is intentionally NOT performed on session-id change — if a user
  // re-enters the same session after switching, a repeat suppression is fine
  // (the persisted ERROR row in history still explains the prior failure).
  // Per-marker-occurrence retries within the same session deliberately do
  // NOT re-fire the snackbar; the user already saw it.
  const webSearchFallbackSeenRef = useRef<Set<string>>(new Set());

  const flushChunkBuffer = useCallback(() => {
    flushScheduledRef.current = false;
    rafIdRef.current = null;
    const pending = chunkBufferRef.current;
    if (pending) {
      chunkBufferRef.current = '';
      dispatch(appendStreamingChunk(pending));
    }
  }, [dispatch]);

  const scheduleFlush = useCallback(() => {
    if (flushScheduledRef.current) return;
    flushScheduledRef.current = true;
    rafIdRef.current = requestAnimationFrame(flushChunkBuffer);
  }, [flushChunkBuffer]);

  const closeStream = useCallback(() => {
    // Flush any buffered chunk text synchronously before tearing down — keeps
    // final tail of the answer from being lost when done/error fires fast.
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    flushScheduledRef.current = false;
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (chunkBufferRef.current) {
      const pending = chunkBufferRef.current;
      chunkBufferRef.current = '';
      dispatch(appendStreamingChunk(pending));
    }
    if (abortControllerRef.current) {
      // Drop the singleton pointer if we own it
      if (activeAbortController === abortControllerRef.current) {
        activeAbortController = null;
      }
      abortControllerRef.current = null;
    }
    isStreamingRef.current = false;
  }, [dispatch]);

  // Cleanup 2026-04-28: arm/rearm the silence watchdog on every received event.
  const armSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      if (!isStreamingRef.current) return;
      closeStream();
      dispatch(clearStreamingMessage());
      enqueueSnackbar(t('search.stream.timeout'), { variant: 'error' });
      onError?.();
    }, STREAM_SILENCE_TIMEOUT_MS);
  }, [closeStream, dispatch, enqueueSnackbar, t, onError]);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    closeStream();
    dispatch(clearStreamingMessage());
  }, [closeStream, dispatch]);

  const start = useCallback(
    (args: StartArgs) => {
      const effectiveSessionId = args.sessionIdOverride ?? sessionId;
      if (!effectiveSessionId) {
        enqueueSnackbar(t('search.stream.error'), { variant: 'error' });
        return;
      }
      if (!activeWorkspaceId) {
        // Fail-fast: no workspace → backend would 400; better to surface here.
        enqueueSnackbar(t('search.stream.error'), { variant: 'error' });
        return;
      }

      // EC-7: cancel any in-flight stream before starting a new one — including
      // streams owned by a different hook instance (e.g. FloatingChatBar's
      // stream when ChatPanel kicks off a new one). Abort BEFORE closeStream
      // so the in-flight fetch reader rejects with AbortError and unwinds.
      abortControllerRef.current?.abort();
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
      closeStream();
      dispatch(clearStreamingMessage());

      const url = buildStreamUrl(effectiveSessionId, searchMode);
      const body = buildRequestBody(args, searchMode);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      activeAbortController = abortController;
      isStreamingRef.current = true;
      // Cleanup 2026-04-28: arm silence watchdog from the moment the stream
      // is initiated — protects against backend that opens the stream and
      // never sends anything (Vane "init then hang" bug).
      armSilenceTimer();

      // PROJ-29 Phase 1J BUG-2 — placeholder step so the ThinkingStrip mounts
      // immediately (it early-returns when `streamingStages.length === 0`).
      // First real SSE `stage` event will flip this row to `done`.
      dispatch(
        pushStreamingStage({
          stage: 'connecting',
          status: 'loading',
          ts: Date.now(),
        }),
      );

      // Track whether a `done` arrived — used to suppress the
      // "connectionLost" path when the server closes the stream cleanly.
      let doneSeen = false;
      // PROJ-29 Phase 1J BUG-2 — close the synthetic `connecting` placeholder
      // the first time a real stage event arrives.
      let connectingClosed = false;

      const handleEvent = (eventName: string, raw: string) => {
        armSilenceTimer();
        switch (eventName) {
          case 'init': {
            const data = parseEventData<SSEInitEvent>(raw);
            if (!data) return;
            dispatch(
              setStreamingAssistantMessage({
                id: data.message_id,
                sources: [],
                content: '',
              }),
            );
            if (data.vision_fallback && data.model_used) {
              enqueueSnackbar(
                t('search.attachments.visionFallback', { model: data.model_used }),
                { variant: 'info' },
              );
            }
            return;
          }
          case 'sources': {
            const data = parseEventData<SSESourcesEvent>(raw);
            if (!data || !Array.isArray(data.sources)) return;
            dispatch(appendStreamingSources(data.sources));
            return;
          }
          case 'chunk': {
            const data = parseEventData<SSEChunkEvent>(raw);
            if (!data || typeof data.text !== 'string') return;
            chunkBufferRef.current += data.text;
            scheduleFlush();
            return;
          }
          case 'stage': {
            const data = parseEventData<SSEStageEvent>(raw);
            if (!data || typeof data.stage !== 'string') return;
            if (!connectingClosed) {
              dispatch(markStageDone({ stage: 'connecting', ts: Date.now() }));
              connectingClosed = true;
            }
            dispatch(
              pushStreamingStage({
                stage: data.stage,
                status: 'loading',
                ts: Date.now(),
              }),
            );
            return;
          }
          case 'heartbeat':
            return; // silence-timer already rearmed above.
          case 'tool_call': {
            const data = parseEventData<SSEToolCallEvent>(raw);
            if (!data || typeof data.tool_name !== 'string') return;
            dispatch(
              pushStreamingStage({
                stage: data.tool_name,
                status: 'loading',
                ts: Date.now(),
              }),
            );
            return;
          }
          case 'tool_result': {
            const data = parseEventData<SSEToolResultEvent>(raw);
            if (!data || typeof data.tool_name !== 'string') return;
            dispatch(markStageDone({ stage: data.tool_name, ts: Date.now() }));
            return;
          }
          case 'tool_timeout': {
            const data = parseEventData<SSEToolTimeoutEvent>(raw);
            if (!data || typeof data.tool_name !== 'string') return;
            dispatch(
              markStageWarning({
                stage: data.tool_name,
                message: data.error,
                reason: 'tool_timeout',
              }),
            );
            return;
          }
          case 'chunks_used': {
            const data = parseEventData<SSEChunksUsedEvent>(raw);
            if (!data || !Array.isArray(data.chunks)) return;
            dispatch(appendChunksUsed(data.chunks));
            return;
          }
          case 'generate_slogans_payload': {
            const data = parseEventData<SSEGenerateSlogansPayloadEvent>(raw);
            if (!data || !Array.isArray(data.slogans)) return;
            dispatch(setStreamingSloganPayload(data.slogans));
            return;
          }
          case 'follow_ups': {
            const data = parseEventData<SSEFollowUpsEvent>(raw);
            if (!data || !Array.isArray(data.chips)) return;
            dispatch(setFollowUps(data.chips.slice(0, 3)));
            return;
          }
          case 'done': {
            const data = parseEventData<SSEDoneEvent>(raw);
            doneSeen = true;
            if (data?.message_id) {
              dispatch(promoteStreamingSloganPayload({ messageId: data.message_id }));
            }
            // FIX-dashboard Item 7: when a tool_timeout fired earlier but
            // the LLM still produced a substantive answer, downgrade the
            // warning stage to info — the search was slow, not failed.
            // Read the accumulated answer length BEFORE clearStreamingMessage.
            const finalAnswerLength =
              store.getState().chatBar.streamingAssistantMessage.content.length;
            dispatch(
              downgradeTimeoutWarningsOnDone({
                finalAnswerLength,
                downgradedMessage: t('chatBar.stages.timeoutDowngradedMessage'),
              }),
            );
            closeStream();
            dispatch(clearStreamingMessage());
            dispatch(
              searchApi.util.invalidateTags([
                { type: 'ChatMessages', id: effectiveSessionId },
                { type: 'ChatSessions', id: effectiveSessionId },
                { type: 'ChatSessions', id: 'LIST' },
              ]),
            );
            if (data?.message_id) {
              onDone?.(data.message_id);
            }
            return;
          }
          case 'error': {
            const data = parseEventData<SSEErrorEvent>(raw);
            doneSeen = true; // server closed deliberately — don't fire connectionLost on top.
            dispatch(markStageError({ message: data?.error }));
            closeStream();
            dispatch(clearStreamingMessage());
            const sid = args.sessionIdOverride ?? sessionId;
            if (sid) {
              dispatch(
                searchApi.util.invalidateTags([
                  { type: 'ChatMessages', id: sid },
                  { type: 'ChatSessions', id: sid },
                ]),
              );
            }
            // FIX-chat-bugfixes-and-grouping Item 2 — friendly fallback when
            // the backend emits the `web_search_unavailable` marker. We fire
            // an info-variant snackbar at most once per session id (tracked
            // in `webSearchFallbackSeenRef`). The synthetic ERROR-bubble is
            // persisted by the backend via the existing PROJ-29 BUG-4 path
            // and surfaces on the next RTK Query refetch — no extra dispatch
            // here. Suppress BOTH the generic error snackbar AND any
            // connectionLost fallback so the info snackbar is the only
            // notification the user sees.
            if (data?.error === 'web_search_unavailable') {
              if (sid && !webSearchFallbackSeenRef.current.has(sid)) {
                webSearchFallbackSeenRef.current.add(sid);
                enqueueSnackbar(
                  t('search.fallback.webSearchUnavailable.snackbar'),
                  { variant: 'info' },
                );
              }
              onError?.();
              return;
            }
            enqueueSnackbar(
              data?.display_message ?? data?.error ?? t('search.stream.connectionLost'),
              { variant: 'error' },
            );
            onError?.();
            return;
          }
          default:
            return; // unknown event — ignore.
        }
      };

      // Run the fetch + parse loop. Any non-AbortError thrown here surfaces
      // as the connection-lost path.
      void (async () => {
        let response: Response;
        try {
          response = await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'X-Workspace-Id': activeWorkspaceId,
            },
            body: JSON.stringify(body),
            signal: abortController.signal,
          });
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            return; // intentional cancel.
          }
          if (!isStreamingRef.current) return;
          closeStream();
          dispatch(clearStreamingMessage());
          enqueueSnackbar(t('search.stream.connectionLost'), { variant: 'error' });
          onError?.();
          return;
        }

        // 401 — mirror the terminal axios-interceptor behavior. fetch
        // bypasses the interceptor entirely, so we replicate clearAuth +
        // redirect here.
        if (response.status === 401) {
          closeStream();
          dispatch(clearStreamingMessage());
          dispatch(clearAuth());
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return;
        }

        // Pre-stream non-2xx (4xx/5xx that isn't 401) — surface backend's
        // display_message if present, no SSE parsing.
        if (!response.ok) {
          let displayMessage: string | undefined;
          try {
            const json = (await response.json()) as { display_message?: string; error?: string };
            displayMessage = json.display_message ?? json.error;
          } catch {
            // body wasn't JSON — fall back to generic message.
          }
          closeStream();
          dispatch(clearStreamingMessage());
          enqueueSnackbar(displayMessage ?? t('search.stream.error'), {
            variant: 'error',
          });
          onError?.();
          return;
        }

        try {
          await parseSSEStream(response, handleEvent);
        } catch {
          // Network-level error mid-stream (DNS, socket close, decode fail).
          if (!isStreamingRef.current) return;
          closeStream();
          dispatch(clearStreamingMessage());
          enqueueSnackbar(t('search.stream.connectionLost'), { variant: 'error' });
          onError?.();
          return;
        }

        // Stream ended cleanly without a `done` event → silence-watchdog
        // already covers it, but if reader returned done synchronously
        // (rare), surface as connection lost.
        if (!doneSeen && isStreamingRef.current) {
          closeStream();
          dispatch(clearStreamingMessage());
          enqueueSnackbar(t('search.stream.connectionLost'), { variant: 'error' });
          onError?.();
        }
      })();
    },
    [
      sessionId,
      activeWorkspaceId,
      searchMode,
      closeStream,
      scheduleFlush,
      armSilenceTimer,
      dispatch,
      enqueueSnackbar,
      store,
      t,
      onDone,
      onError,
    ],
  );

  // Cleanup on unmount or session change
  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
      closeStream();
    },
    [closeStream],
  );

  return {
    start,
    stop,
    isStreaming,
  };
};
