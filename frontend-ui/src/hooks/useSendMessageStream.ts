/**
 * PROJ-17 Phase 4 Step 6: SSE streaming hook for chat messages.
 *
 * Wraps the browser EventSource API around the backend SSE endpoint
 * `GET /api/chat/sessions/{session_id}/messages/stream/`.
 *
 * Cookies (httpOnly JWT) are sent automatically because the request hits the
 * same origin via the Vite proxy in dev and same domain in prod, so we set
 * `withCredentials: true` to be explicit.
 *
 * Events handled (matches backend StreamingHttpResponse):
 *   init    → setStreamingAssistantMessage({id, sources: [], content: ''})
 *   sources → appendStreamingSources([...WebSearchResult])
 *   chunk   → buffer + rAF-batched appendStreamingChunk(text)
 *   done    → clearStreamingMessage + RTK Query tag invalidation + onDone(message_id)
 *   error   → close + clear + notistack error
 *
 * EC-7: starting a new stream cancels any active stream (close existing ES first).
 *
 * Memory hygiene:
 *   - Chunks are buffered and dispatched once per animation frame (~16ms)
 *     instead of one Redux action per SSE event. Drops Redux DevTools
 *     history bloat from ~100 actions/answer to ~5–10.
 *   - A module-scoped singleton ref tracks the currently-active EventSource
 *     across all hook instances (FloatingChatBar + ChatPanel both call this
 *     hook). Starting a new stream from any caller closes the previous one,
 *     preventing two concurrent streams from corrupting Redux content.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setStreamingAssistantMessage,
  appendStreamingChunk,
  appendStreamingSources,
  clearStreamingMessage,
} from '@/store/chatBarSlice';
import { searchApi } from '@/store/searchSlice';
import type {
  ModeOverride,
  SSEInitEvent,
  SSESourcesEvent,
  SSEChunkEvent,
  SSEDoneEvent,
  SSEErrorEvent,
} from '@/types/search';

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
 * Cleanup 2026-04-28 (PROJ-20 follow-up): the SSE stream endpoint is the Vane
 * (Chat-mode) path only — Agent-mode goes via POST. So the URL only needs:
 *   - content       : the user's question
 *   - niche_id      : optional niche-context id (server falls back to session.niche_context)
 *   - mode_override : informational (server logs it; doesn't affect routing here)
 *
 * `search_mode` (Vane optimization: speed/balanced/quality) is intentionally
 * omitted — backend defaults to 'balanced'. If we ever surface that knob,
 * add a separate `optimization_mode` URL param.
 */
const buildStreamUrl = (
  sessionId: string,
  { content, mode_override, niche_id, attachment_ids, model }: StartArgs,
): string => {
  const params = new URLSearchParams();
  params.set('content', content);
  if (mode_override) params.set('mode_override', mode_override);
  if (niche_id) params.set('niche_id', niche_id);
  if (attachment_ids && attachment_ids.length > 0) {
    params.set('attachment_ids', attachment_ids.join(','));
  }
  if (model) params.set('model', model);
  return `/api/chat/sessions/${sessionId}/messages/stream/?${params.toString()}`;
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

// Module-scoped singleton — the only EventSource that should be active at any
// time across all useSendMessageStream consumers. Closing this on every new
// start() prevents Bar + ChatPanel race conditions where two streams could
// otherwise dispatch chunks into the same Redux slice concurrently.
let activeEventSource: EventSource | null = null;

export const useSendMessageStream = ({
  sessionId,
  onDone,
  onError,
}: UseSendMessageStreamOptions): UseSendMessageStreamReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );

  const eventSourceRef = useRef<EventSource | null>(null);
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
    if (eventSourceRef.current) {
      // Drop the singleton pointer if we own it
      if (activeEventSource === eventSourceRef.current) {
        activeEventSource = null;
      }
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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

      // EC-7: cancel any in-flight stream before starting a new one — including
      // streams owned by a different hook instance (e.g. FloatingChatBar's
      // stream when ChatPanel kicks off a new one).
      closeStream();
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      dispatch(clearStreamingMessage());

      const url = buildStreamUrl(effectiveSessionId, args);

      let es: EventSource;
      try {
        es = new EventSource(url, { withCredentials: true });
      } catch {
        enqueueSnackbar(t('search.stream.error'), { variant: 'error' });
        return;
      }

      eventSourceRef.current = es;
      activeEventSource = es;
      isStreamingRef.current = true;
      // Cleanup 2026-04-28: arm silence watchdog from the moment the
      // EventSource opens — protects against backend that opens the stream
      // and never sends anything (Vane "init then hang" bug).
      armSilenceTimer();

      es.addEventListener('init', (event) => {
        armSilenceTimer();
        const data = parseEventData<SSEInitEvent>((event as MessageEvent).data);
        if (!data) return;
        dispatch(
          setStreamingAssistantMessage({
            id: data.message_id,
            sources: [],
            content: '',
          }),
        );
        // Phase 7.6 — surface the vision-model fallback so users know we
        // swapped their selected (non-vision) model out for this request.
        if (data.vision_fallback && data.model_used) {
          enqueueSnackbar(
            t('search.attachments.visionFallback', { model: data.model_used }),
            { variant: 'info' },
          );
        }
      });

      es.addEventListener('sources', (event) => {
        armSilenceTimer();
        const data = parseEventData<SSESourcesEvent>((event as MessageEvent).data);
        if (!data || !Array.isArray(data.sources)) return;
        dispatch(appendStreamingSources(data.sources));
      });

      es.addEventListener('chunk', (event) => {
        armSilenceTimer();
        const data = parseEventData<SSEChunkEvent>((event as MessageEvent).data);
        if (!data || typeof data.text !== 'string') return;
        chunkBufferRef.current += data.text;
        scheduleFlush();
      });

      es.addEventListener('done', (event) => {
        const data = parseEventData<SSEDoneEvent>((event as MessageEvent).data);
        closeStream();
        dispatch(clearStreamingMessage());
        // Force RTK Query refetch — persisted message + session refresh
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
      });

      // SSE-level error event from server
      es.addEventListener('error', (event) => {
        const messageEvent = event as MessageEvent;
        const data =
          typeof messageEvent.data === 'string'
            ? parseEventData<SSEErrorEvent>(messageEvent.data)
            : null;
        closeStream();
        dispatch(clearStreamingMessage());
        enqueueSnackbar(data?.error ?? t('search.stream.connectionLost'), {
          variant: 'error',
        });
        onError?.();
      });

      // Connection-level error fallback (no `data` payload — onerror handler)
      es.onerror = () => {
        if (!isStreamingRef.current) return;
        closeStream();
        dispatch(clearStreamingMessage());
        enqueueSnackbar(t('search.stream.connectionLost'), { variant: 'error' });
        onError?.();
      };
    },
    [sessionId, closeStream, scheduleFlush, armSilenceTimer, dispatch, enqueueSnackbar, t, onDone, onError],
  );

  // Cleanup on unmount or session change
  useEffect(
    () => () => {
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
