/**
 * PROJ-17 Phase 6 — useSendMessageStream hook tests
 *
 * Mocks the global EventSource API. Verifies SSE event dispatch into
 * chatBarSlice (init/sources/chunk/done/error), URL building, EC-7 cancel-on-restart,
 * unmount cleanup, and isStreaming state.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SnackbarProvider } from 'notistack';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../public/locales/en/translation.json';

import chatBarReducer from '../../store/chatBarSlice';

// ---- searchApi stub ----
// The real searchSlice imports axiosBaseQuery → authService → store → searchSlice
// (circular). We stub it minimally — the hook only uses
// `searchApi.util.invalidateTags(...)`, which is dispatched. Returning a
// plain action object satisfies dispatch + middleware.
const { mockInvalidateTags } = vi.hoisted(() => ({
  mockInvalidateTags: vi.fn(
    (tags: unknown) => ({ type: 'searchApi/invalidateTags', payload: tags }) as const,
  ),
}));

vi.mock('../../store/searchSlice', () => ({
  searchApi: {
    reducerPath: 'searchApi',
    util: {
      invalidateTags: mockInvalidateTags,
    },
  },
}));

import { useSendMessageStream } from '../useSendMessageStream';

// ---- i18n bootstrap ----
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

// ---- notistack mock ----
const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
  };
});

// ---- MockEventSource ----
type Listener = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  url: string;
  withCredentials: boolean;
  closed = false;
  onerror: ((event: Event) => void) | null = null;
  private listeners: Record<string, Listener[]> = {};

  constructor(url: string | URL, init?: EventSourceInit) {
    this.url = url.toString();
    this.withCredentials = !!init?.withCredentials;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  /** Test helper: dispatch a typed SSE event with data (init/sources/chunk/done/error). */
  emit(type: string, data: unknown) {
    const event = new MessageEvent(type, {
      data: typeof data === 'string' ? data : JSON.stringify(data),
    });
    (this.listeners[type] ?? []).forEach((l) => l(event));
  }

  /** Trigger connection-level error (no data payload) → goes to onerror. */
  triggerConnectionError() {
    if (this.onerror) this.onerror(new Event('error'));
  }

  close() {
    this.closed = true;
  }

  static reset() {
    MockEventSource.instances = [];
  }
}

vi.stubGlobal('EventSource', MockEventSource);

// ---- store + wrapper helper ----
// We do NOT register searchApi.reducer here because the real searchSlice is
// stubbed (see vi.mock above). The hook only uses searchApi.util.invalidateTags
// (an action creator), so a plain reducer + default middleware is enough.
const buildStore = () =>
  configureStore({
    reducer: {
      chatBar: chatBarReducer,
    },
  });

let store: ReturnType<typeof buildStore>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <SnackbarProvider>{children}</SnackbarProvider>
  </Provider>
);

// ---- test fixtures ----
const SESSION_ID = 'session-abc-123';
const MESSAGE_ID = 'msg-xyz-789';

const renderStreamHook = (overrides?: { sessionId?: string | null; onDone?: (id: string) => void }) =>
  renderHook(
    () =>
      useSendMessageStream({
        sessionId: overrides?.sessionId === undefined ? SESSION_ID : overrides.sessionId,
        onDone: overrides?.onDone,
      }),
    { wrapper },
  );

beforeEach(() => {
  store = buildStore();
  MockEventSource.reset();
  mockEnqueueSnackbar.mockReset();
  mockInvalidateTags.mockClear();
  // The hook batches `chunk` dispatches via requestAnimationFrame. jsdom
  // queues rAF via setTimeout, which would not fire inside a synchronous
  // act() block — so we run rAF callbacks synchronously in tests. Production
  // still gets per-frame batching.
  vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
    cb(0);
    return 0;
  });
  vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('useSendMessageStream', () => {
  it('start opens EventSource with correct URL and search params', () => {
    const { result } = renderStreamHook();

    act(() => {
      result.current.start({ content: 'hello world', mode_override: 'chat' });
    });

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain(`/api/chat/sessions/${SESSION_ID}/messages/stream/`);
    expect(es.url).toContain('content=hello+world');
    // Cleanup 2026-04-28: mode_override is sent verbatim ('chat'/'agent');
    // backend reads optimization_mode separately (defaults to 'balanced').
    expect(es.url).toContain('mode_override=chat');
    expect(es.url).not.toContain('search_mode=');
    expect(es.withCredentials).toBe(true);
  });

  it('appends niche_id to URL when provided', () => {
    const { result } = renderStreamHook();

    act(() => {
      result.current.start({
        content: 'q',
        mode_override: 'chat',
        niche_id: 'niche-42',
      });
    });

    const es = MockEventSource.instances[0];
    expect(es.url).toContain('niche_id=niche-42');
    expect(es.url).toContain('mode_override=chat');
  });

  it('omits niche_id from URL when null', () => {
    const { result } = renderStreamHook();

    act(() => {
      result.current.start({ content: 'q', niche_id: null });
    });

    const es = MockEventSource.instances[0];
    expect(es.url).not.toContain('niche_id');
  });

  it('init event dispatches setStreamingAssistantMessage', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });

    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });

    const stream = store.getState().chatBar.streamingAssistantMessage;
    expect(stream.id).toBe(MESSAGE_ID);
    expect(stream.isStreaming).toBe(true);
    expect(stream.content).toBe('');
    expect(stream.sources).toEqual([]);
  });

  it('chunk events accumulate text content', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });

    // Need init first so isStreaming flag is true (appendStreamingChunk gates on it)
    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });

    act(() => {
      MockEventSource.instances[0].emit('chunk', { text: 'Hello ' });
      MockEventSource.instances[0].emit('chunk', { text: 'streaming ' });
      MockEventSource.instances[0].emit('chunk', { text: 'world!' });
    });

    expect(store.getState().chatBar.streamingAssistantMessage.content).toBe(
      'Hello streaming world!',
    );
  });

  it('sources event populates streaming sources', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });

    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });

    const sources = [
      { title: 'Source 1', url: 'https://a.com', snippet: 'snippet 1' },
      { title: 'Source 2', url: 'https://b.com', snippet: 'snippet 2' },
    ];

    act(() => {
      MockEventSource.instances[0].emit('sources', { sources });
    });

    expect(store.getState().chatBar.streamingAssistantMessage.sources).toEqual(sources);
  });

  it('done event clears streaming, closes ES, and calls onDone callback', () => {
    const onDone = vi.fn();
    const { result } = renderStreamHook({ onDone });
    act(() => {
      result.current.start({ content: 'hi' });
    });
    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      MockEventSource.instances[0].emit('chunk', { text: 'partial' });
    });

    act(() => {
      MockEventSource.instances[0].emit('done', {
        message_id: MESSAGE_ID,
        total_tokens: 42,
      });
    });

    const stream = store.getState().chatBar.streamingAssistantMessage;
    expect(stream.isStreaming).toBe(false);
    expect(stream.content).toBe('');
    expect(stream.id).toBeNull();
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(onDone).toHaveBeenCalledWith(MESSAGE_ID);
  });

  it('error event clears streaming and notifies via notistack', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });

    act(() => {
      MockEventSource.instances[0].emit('error', { error: 'Backend unavailable' });
    });

    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(false);
    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Backend unavailable', {
      variant: 'error',
    });
  });

  it('connection-level error (onerror) clears streaming and shows fallback message', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });

    act(() => {
      MockEventSource.instances[0].triggerConnectionError();
    });

    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(false);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Connection lost'),
      { variant: 'error' },
    );
  });

  it('stop() closes EventSource and clears streaming state', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });

    act(() => {
      result.current.stop();
    });

    expect(MockEventSource.instances[0].closed).toBe(true);
    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(false);
  });

  it('EC-7: starting a second stream cancels the first', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'first' });
    });
    expect(MockEventSource.instances).toHaveLength(1);
    const first = MockEventSource.instances[0];

    act(() => {
      result.current.start({ content: 'second' });
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(first.closed).toBe(true);
    expect(MockEventSource.instances[1].closed).toBe(false);
  });

  it('cross-instance: second hook starting a stream closes the first hook’s stream', () => {
    // Mirrors the production layout where FloatingChatBar and ChatPanel each
    // own a useSendMessageStream instance. A new stream from instance B must
    // close instance A's EventSource so chunks don't dispatch into a stale
    // streaming message.
    const { result: hookA } = renderStreamHook();
    const { result: hookB } = renderStreamHook();

    act(() => {
      hookA.current.start({ content: 'from A' });
    });
    const esA = MockEventSource.instances[0];
    expect(esA.closed).toBe(false);

    act(() => {
      hookB.current.start({ content: 'from B' });
    });

    expect(MockEventSource.instances).toHaveLength(2);
    expect(esA.closed).toBe(true);
    expect(MockEventSource.instances[1].closed).toBe(false);
  });

  it('unmount closes any active EventSource', () => {
    const { result, unmount } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    const es = MockEventSource.instances[0];
    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
  });

  it('isStreaming reflects state across init→done lifecycle', () => {
    const { result } = renderStreamHook();
    expect(result.current.isStreaming).toBe(false);

    act(() => {
      result.current.start({ content: 'hi' });
    });
    expect(result.current.isStreaming).toBe(false); // not yet streaming until init

    act(() => {
      MockEventSource.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
    });
    expect(result.current.isStreaming).toBe(true);

    act(() => {
      MockEventSource.instances[0].emit('done', {
        message_id: MESSAGE_ID,
        total_tokens: 0,
      });
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it('encodeURIComponent: special chars in content are URL-encoded', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'a & b ? c = d' });
    });
    const es = MockEventSource.instances[0];
    // URLSearchParams encodes spaces as '+' and '&' as '%26', '?' as '%3F', '=' as '%3D'
    expect(es.url).toContain('content=a+%26+b+%3F+c+%3D+d');
  });

  it('shows error snackbar when starting without sessionId', () => {
    const { result } = renderStreamHook({ sessionId: null });
    act(() => {
      result.current.start({ content: 'hi' });
    });
    expect(MockEventSource.instances).toHaveLength(0);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Streaming failed'),
      { variant: 'error' },
    );
  });

  it('sessionIdOverride is used even when hook bound to null sessionId', () => {
    const { result } = renderStreamHook({ sessionId: null });
    act(() => {
      result.current.start({
        content: 'hi',
        sessionIdOverride: 'override-session-1',
      });
    });
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toContain(
      '/api/chat/sessions/override-session-1/messages/stream/',
    );
  });

  it('malformed event JSON is ignored gracefully', () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });

    act(() => {
      MockEventSource.instances[0].emit('init', '{"not valid json');
    });

    // No state change because parse failed
    expect(store.getState().chatBar.streamingAssistantMessage.id).toBeNull();
    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(
      false,
    );
  });
});
