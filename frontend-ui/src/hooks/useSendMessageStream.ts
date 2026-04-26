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
 *   chunk   → appendStreamingChunk(text)
 *   done    → clearStreamingMessage + RTK Query tag invalidation + onDone(message_id)
 *   error   → close + clear + notistack error
 *
 * EC-7: starting a new stream cancels any active stream (close existing ES first).
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
}

interface StartArgs {
  content: string;
  mode_override?: ModeOverride;
  niche_id?: string | null;
  /** Optional override — useful right after creating a session when the
   *  hook's bound sessionId hasn't propagated yet. */
  sessionIdOverride?: string;
}

interface UseSendMessageStreamReturn {
  start: (args: StartArgs) => void;
  stop: () => void;
  isStreaming: boolean;
}

const buildStreamUrl = (
  sessionId: string,
  { content, mode_override, niche_id }: StartArgs,
): string => {
  const params = new URLSearchParams();
  params.set('content', content);
  params.set('search_mode', mode_override || 'auto');
  if (niche_id) {
    params.set('niche_id', niche_id);
  }
  return `/api/chat/sessions/${sessionId}/messages/stream/?${params.toString()}`;
};

const parseEventData = <T,>(raw: string): T | null => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const useSendMessageStream = ({
  sessionId,
  onDone,
}: UseSendMessageStreamOptions): UseSendMessageStreamReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const isStreaming = useAppSelector(
    (s) => s.chatBar.streamingAssistantMessage.isStreaming,
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const isStreamingRef = useRef(false);

  const closeStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    isStreamingRef.current = false;
  }, []);

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

      // EC-7: cancel any in-flight stream before starting a new one
      closeStream();
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
      isStreamingRef.current = true;

      es.addEventListener('init', (event) => {
        const data = parseEventData<SSEInitEvent>((event as MessageEvent).data);
        if (!data) return;
        dispatch(
          setStreamingAssistantMessage({
            id: data.message_id,
            sources: [],
            content: '',
          }),
        );
      });

      es.addEventListener('sources', (event) => {
        const data = parseEventData<SSESourcesEvent>((event as MessageEvent).data);
        if (!data || !Array.isArray(data.sources)) return;
        dispatch(appendStreamingSources(data.sources));
      });

      es.addEventListener('chunk', (event) => {
        const data = parseEventData<SSEChunkEvent>((event as MessageEvent).data);
        if (!data || typeof data.text !== 'string') return;
        dispatch(appendStreamingChunk(data.text));
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
      });

      // Connection-level error fallback (no `data` payload — onerror handler)
      es.onerror = () => {
        if (!isStreamingRef.current) return;
        closeStream();
        dispatch(clearStreamingMessage());
        enqueueSnackbar(t('search.stream.connectionLost'), { variant: 'error' });
      };
    },
    [sessionId, closeStream, dispatch, enqueueSnackbar, t, onDone],
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
