/**
 * useSendMessageStream hook tests (post FIX 2026-05-28: GET/EventSource → POST/fetch).
 *
 * Mocks the global `fetch` and feeds an in-memory `ReadableStream` of SSE
 * bytes into the hook's parser. Verifies SSE event dispatch into chatBarSlice
 * (init, sources, chunk, done, error, stage, tool_call/result, follow_ups), POST body shape,
 * EC-7 cancel-on-restart, unmount cleanup, isStreaming state, 401 →
 * clearAuth + redirect.
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
import authReducer, { setUser } from '../../store/authSlice';

// Mock workspaceService to avoid pulling in the global store (workspaceSlice
// imports workspaceService → authService → store; that circular pulls in
// every RTK Query api whose middleware we'd need to register here). The hook
// itself only reads `s.workspace.activeWorkspaceId`, so a tiny inline reducer
// is enough.
vi.mock('../../services/workspaceService', () => ({
  workspaceService: {},
}));
import workspaceReducer, { setActiveWorkspace } from '../../store/workspaceSlice';

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

// ---- MockStreamController + fetch stub ----
/**
 * Drives the SSE response body. Tests push SSE-shaped strings via `emit()`,
 * which encodes them and enqueues onto the ReadableStream controller. The
 * hook's parser reads via `response.body.getReader()`.
 */
class MockStreamController {
  static instances: MockStreamController[] = [];

  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
  signal: AbortSignal;
  status: number;
  /** Resolved with the Response once the test pushes the first chunk. */
  response: Response;
  closed = false;

  private controller!: ReadableStreamDefaultController<Uint8Array>;
  private encoder = new TextEncoder();

  constructor(
    url: string,
    init: RequestInit & { signal: AbortSignal },
    options: { status?: number; preBodyJson?: unknown } = {},
  ) {
    this.url = url;
    this.method = init.method ?? 'GET';
    this.body = init.body ? JSON.parse(init.body as string) : null;
    this.headers = (init.headers ?? {}) as Record<string, string>;
    this.signal = init.signal;
    this.status = options.status ?? 200;

    if (this.status !== 200 && options.preBodyJson) {
      this.response = new Response(JSON.stringify(options.preBodyJson), {
        status: this.status,
        headers: { 'Content-Type': 'application/json' },
      });
    } else if (this.status === 401) {
      this.response = new Response(null, { status: 401 });
    } else {
      const stream = new ReadableStream<Uint8Array>({
        start: (c) => {
          this.controller = c;
        },
      });
      this.response = new Response(stream, {
        status: this.status,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }

    // Abort wiring — when the hook calls abort(), close the stream.
    this.signal.addEventListener('abort', () => {
      this.closed = true;
      try {
        this.controller?.error(
          Object.assign(new Error('aborted'), { name: 'AbortError' }),
        );
      } catch {
        // already closed.
      }
    });

    MockStreamController.instances.push(this);
  }

  /** Push a typed SSE event record. */
  emit(eventName: string, data: unknown) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const record = `event: ${eventName}\ndata: ${payload}\n\n`;
    this.controller.enqueue(this.encoder.encode(record));
  }

  /** Push a raw record (used for malformed-JSON test). */
  emitRaw(record: string) {
    this.controller.enqueue(this.encoder.encode(record));
  }

  /** Close the stream cleanly (server done). */
  closeStream() {
    this.closed = true;
    try {
      this.controller.close();
    } catch {
      // already closed.
    }
  }

  /** Simulate a mid-stream network error. */
  errorStream() {
    this.closed = true;
    try {
      this.controller.error(new Error('connection lost'));
    } catch {
      // already closed.
    }
  }

  static reset() {
    MockStreamController.instances = [];
  }
}

interface FetchMockOptions {
  status?: number;
  preBodyJson?: unknown;
  /** When set, fetch rejects with this error instead of resolving. */
  rejectWith?: Error;
}

const fetchMockOptionsQueue: FetchMockOptions[] = [];

const mockFetch = vi.fn(
  async (url: string | URL, init: RequestInit): Promise<Response> => {
    const opts = fetchMockOptionsQueue.shift() ?? {};
    if (opts.rejectWith) throw opts.rejectWith;
    const ctrl = new MockStreamController(url.toString(), init as RequestInit & { signal: AbortSignal }, opts);
    return ctrl.response;
  },
);

vi.stubGlobal('fetch', mockFetch);

// ---- store + wrapper helper ----
// We do NOT register searchApi.reducer here because the real searchSlice is
// stubbed (see vi.mock above). The hook only uses searchApi.util.invalidateTags
// (an action creator), so a plain reducer + default middleware is enough.
const WORKSPACE_ID = 'ws-test-1';

const buildStore = () => {
  const s = configureStore({
    reducer: {
      chatBar: chatBarReducer,
      auth: authReducer,
      workspace: workspaceReducer,
    },
  });
  // Seed an authenticated session + active workspace so start() doesn't
  // early-exit on the activeWorkspaceId guard.
  s.dispatch(
    setUser({
      id: 1,
      email: 't@t.com',
      first_name: 'T',
      avatar_url: null,
      is_staff: false,
      is_superuser: false,
      subscription_tier: 'free',
      features: [],
    }),
  );
  s.dispatch(setActiveWorkspace(WORKSPACE_ID));
  return s;
};

let store: ReturnType<typeof buildStore>;

const wrapper = ({ children }: { children: ReactNode }) => (
  <Provider store={store}>
    <SnackbarProvider>{children}</SnackbarProvider>
  </Provider>
);

// ---- test fixtures ----
const SESSION_ID = 'session-abc-123';
const MESSAGE_ID = 'msg-xyz-789';

const renderStreamHook = (overrides?: {
  sessionId?: string | null;
  onDone?: (id: string) => void;
  onError?: () => void;
}) =>
  renderHook(
    () =>
      useSendMessageStream({
        sessionId:
          overrides?.sessionId === undefined ? SESSION_ID : overrides.sessionId,
        onDone: overrides?.onDone,
        onError: overrides?.onError,
      }),
    { wrapper },
  );

/**
 * Wait one microtask + flush any pending Promise resolutions. The hook runs
 * fetch + parse in an async IIFE inside `start()`; tests need to let the
 * Promise queue drain before asserting.
 */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  store = buildStore();
  MockStreamController.reset();
  fetchMockOptionsQueue.length = 0;
  mockEnqueueSnackbar.mockReset();
  mockFetch.mockClear();
  mockInvalidateTags.mockClear();
  // rAF runs synchronously so chunk dispatches land inside the same act() tick.
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
  it('start fires POST with correct URL, headers, and JSON body', async () => {
    const { result } = renderStreamHook();

    act(() => {
      result.current.start({ content: 'hello world', mode_override: 'chat' });
    });
    await flush();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0];
    expect(String(calledUrl)).toContain(
      `/api/chat/sessions/${SESSION_ID}/messages/stream/`,
    );
    expect(calledInit.method).toBe('POST');
    expect(calledInit.credentials).toBe('include');
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Workspace-Id']).toBe(WORKSPACE_ID);
    expect(JSON.parse(calledInit.body as string)).toEqual({
      content: 'hello world',
      mode_override: 'chat',
      optimization_mode: 'speed',
    });
  });

  it('includes niche_id in body when provided', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({
        content: 'q',
        mode_override: 'chat',
        niche_id: 'niche-42',
      });
    });
    await flush();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.niche_id).toBe('niche-42');
    expect(body.mode_override).toBe('chat');
  });

  it('omits niche_id from body when null', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'q', niche_id: null });
    });
    await flush();

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body).not.toHaveProperty('niche_id');
  });

  it('init event dispatches setStreamingAssistantMessage', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      await Promise.resolve();
    });

    const stream = store.getState().chatBar.streamingAssistantMessage;
    expect(stream.id).toBe(MESSAGE_ID);
    expect(stream.isStreaming).toBe(true);
    expect(stream.content).toBe('');
    expect(stream.sources).toEqual([]);
  });

  it('chunk events accumulate text content', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      MockStreamController.instances[0].emit('chunk', { text: 'Hello ' });
      MockStreamController.instances[0].emit('chunk', { text: 'streaming ' });
      MockStreamController.instances[0].emit('chunk', { text: 'world!' });
      await Promise.resolve();
    });

    expect(store.getState().chatBar.streamingAssistantMessage.content).toBe(
      'Hello streaming world!',
    );
  });

  it('sources event populates streaming sources', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    const sources = [
      { title: 'Source 1', url: 'https://a.com', snippet: 'snippet 1' },
      { title: 'Source 2', url: 'https://b.com', snippet: 'snippet 2' },
    ];

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      MockStreamController.instances[0].emit('sources', { sources });
      await Promise.resolve();
    });

    expect(store.getState().chatBar.streamingAssistantMessage.sources).toEqual(
      sources,
    );
  });

  it('done event clears streaming, calls onDone, and invalidates tags', async () => {
    const onDone = vi.fn();
    const { result } = renderStreamHook({ onDone });
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      MockStreamController.instances[0].emit('chunk', { text: 'partial' });
      MockStreamController.instances[0].emit('done', {
        message_id: MESSAGE_ID,
        total_tokens: 42,
      });
      await Promise.resolve();
    });

    const stream = store.getState().chatBar.streamingAssistantMessage;
    expect(stream.isStreaming).toBe(false);
    expect(stream.content).toBe('');
    expect(stream.id).toBeNull();
    expect(onDone).toHaveBeenCalledWith(MESSAGE_ID);
    expect(mockInvalidateTags).toHaveBeenCalled();
  });

  it('error event clears streaming and notifies via notistack', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      MockStreamController.instances[0].emit('error', {
        error: 'Backend unavailable',
      });
      await Promise.resolve();
    });

    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(
      false,
    );
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Backend unavailable', {
      variant: 'error',
    });
  });

  it('connection-level error (mid-stream socket break) shows connectionLost', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      await Promise.resolve();
    });

    await act(async () => {
      MockStreamController.instances[0].errorStream();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(
      false,
    );
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Connection lost'),
      { variant: 'error' },
    );
  });

  it('stop() aborts the stream and clears streaming state', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      await Promise.resolve();
    });

    act(() => {
      result.current.stop();
    });
    await flush();

    expect(MockStreamController.instances[0].closed).toBe(true);
    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(
      false,
    );
  });

  it('EC-7: starting a second stream aborts the first', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'first' });
    });
    await flush();
    expect(MockStreamController.instances).toHaveLength(1);
    const first = MockStreamController.instances[0];

    act(() => {
      result.current.start({ content: 'second' });
    });
    await flush();

    expect(MockStreamController.instances).toHaveLength(2);
    expect(first.closed).toBe(true);
    expect(MockStreamController.instances[1].closed).toBe(false);
  });

  it('cross-instance: second hook starting a stream aborts the first hook’s stream', async () => {
    const { result: hookA } = renderStreamHook();
    const { result: hookB } = renderStreamHook();

    act(() => {
      hookA.current.start({ content: 'from A' });
    });
    await flush();
    const ctrlA = MockStreamController.instances[0];
    expect(ctrlA.closed).toBe(false);

    act(() => {
      hookB.current.start({ content: 'from B' });
    });
    await flush();

    expect(MockStreamController.instances).toHaveLength(2);
    expect(ctrlA.closed).toBe(true);
    expect(MockStreamController.instances[1].closed).toBe(false);
  });

  it('unmount aborts any active stream', async () => {
    const { result, unmount } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();
    const ctrl = MockStreamController.instances[0];
    expect(ctrl.closed).toBe(false);

    unmount();
    await flush();

    expect(ctrl.closed).toBe(true);
  });

  it('isStreaming reflects state across init→done lifecycle', async () => {
    const { result } = renderStreamHook();
    expect(result.current.isStreaming).toBe(false);

    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();
    expect(result.current.isStreaming).toBe(false); // not yet streaming until init

    await act(async () => {
      MockStreamController.instances[0].emit('init', {
        message_id: MESSAGE_ID,
        session_id: SESSION_ID,
        mode: 'auto',
      });
      await Promise.resolve();
    });
    expect(result.current.isStreaming).toBe(true);

    await act(async () => {
      MockStreamController.instances[0].emit('done', {
        message_id: MESSAGE_ID,
        total_tokens: 0,
      });
      await Promise.resolve();
    });
    expect(result.current.isStreaming).toBe(false);
  });

  it('shows error snackbar when starting without sessionId', async () => {
    const { result } = renderStreamHook({ sessionId: null });
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('Streaming failed'),
      { variant: 'error' },
    );
  });

  it('sessionIdOverride is used even when hook bound to null sessionId', async () => {
    const { result } = renderStreamHook({ sessionId: null });
    act(() => {
      result.current.start({
        content: 'hi',
        sessionIdOverride: 'override-session-1',
      });
    });
    await flush();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain(
      '/api/chat/sessions/override-session-1/messages/stream/',
    );
  });

  // 401 — replicate axios-interceptor terminal behavior.
  it('fetch returns 401 → dispatches clearAuth and redirects to /login', async () => {
    fetchMockOptionsQueue.push({ status: 401 });

    const originalHref = window.location.href;
    const hrefSetter = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/chat',
        // jsdom rejects setting `href` directly; use a getter+setter spy.
        get href() {
          return originalHref;
        },
        set href(v: string) {
          hrefSetter(v);
        },
      },
    });

    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    // auth cleared.
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.user).toBeNull();
    // redirected.
    expect(hrefSetter).toHaveBeenCalledWith('/login');
  });

  // PROJ-29 Phase 1H — ThinkingStrip SSE events
  describe('PROJ-29 thinking SSE events', () => {
    it('stage event pushes a loading ThinkingStep', async () => {
      const { result } = renderStreamHook();
      act(() => {
        result.current.start({ content: 'hi' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('stage', {
          stage: 'retrieve_niche',
        });
        await Promise.resolve();
      });
      const stages = store.getState().chatBar.streamingStages;
      // First stage closes the synthetic `connecting` row → 2 entries total.
      const realStage = stages.find((s) => s.stage === 'retrieve_niche');
      expect(realStage).toBeDefined();
      expect(realStage?.status).toBe('loading');
    });

    it('tool_call then tool_result flips status loading → done', async () => {
      const { result } = renderStreamHook();
      act(() => {
        result.current.start({ content: 'hi' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('tool_call', {
          tool_name: 'search_slogans',
        });
        await Promise.resolve();
      });
      const stagesAfterCall = store.getState().chatBar.streamingStages;
      const row = stagesAfterCall.find((s) => s.stage === 'search_slogans');
      expect(row?.status).toBe('loading');

      await act(async () => {
        MockStreamController.instances[0].emit('tool_result', {
          tool_name: 'search_slogans',
          duration_ms: 800,
        });
        await Promise.resolve();
      });
      const stagesAfterResult = store.getState().chatBar.streamingStages;
      const updated = stagesAfterResult.find((s) => s.stage === 'search_slogans');
      expect(updated?.status).toBe('done');
      expect(typeof updated?.durationMs).toBe('number');
    });

    it('chunks_used event dispatches appendChunksUsed', async () => {
      const { result } = renderStreamHook();
      act(() => {
        result.current.start({ content: 'hi' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('chunks_used', {
          chunks: [
            { index: 1, content_subtype: 'slogan', text: 'Camping dad slogan' },
            { index: 2, content_subtype: 'web', text: 'Reddit thread', url: 'https://r.com' },
          ],
        });
        await Promise.resolve();
      });
      const chunks = store.getState().chatBar.chunksUsed;
      expect(chunks).toHaveLength(2);
      expect(chunks[0].content_subtype).toBe('slogan');
      expect(chunks[1].url).toBe('https://r.com');
    });

    it('follow_ups event stores up to 3 chips', async () => {
      const { result } = renderStreamHook();
      act(() => {
        result.current.start({ content: 'hi' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('follow_ups', {
          chips: ['What about kids?', 'BSR data?', 'Try sarcasm', 'extra ignored'],
        });
        await Promise.resolve();
      });
      expect(store.getState().chatBar.followUps).toEqual([
        'What about kids?',
        'BSR data?',
        'Try sarcasm',
      ]);
    });
  });

  // FIX-chat-bugfixes-and-grouping Phase 6 (Item 2) — `web_search_unavailable`
  // SSE marker → info-variant snackbar fires at most once per session id.
  describe('web search fallback marker', () => {
    it('fires an info-variant snackbar with the title key on first marker', async () => {
      const { result } = renderStreamHook();
      act(() => {
        result.current.start({ content: 'hi' });
      });
      await flush();

      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('error', {
          error: 'web_search_unavailable',
        });
        await Promise.resolve();
      });

      const infoCalls = mockEnqueueSnackbar.mock.calls.filter(
        (c) => c[1]?.variant === 'info',
      );
      expect(infoCalls.length).toBe(1);
      // EN translation of search.fallback.webSearchUnavailable.snackbar
      expect(infoCalls[0][0]).toBe('Web search temporarily unavailable');
    });

    it('does NOT fire the connectionLost / error snackbar when the marker is present', async () => {
      const { result } = renderStreamHook();
      act(() => {
        result.current.start({ content: 'hi' });
      });
      await flush();

      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('error', {
          error: 'web_search_unavailable',
        });
        await Promise.resolve();
      });

      const errorCalls = mockEnqueueSnackbar.mock.calls.filter(
        (c) => c[1]?.variant === 'error',
      );
      expect(errorCalls.length).toBe(0);
    });

    it('does NOT re-fire the snackbar on a second marker within the same session id', async () => {
      const { result } = renderStreamHook();

      // First marker.
      act(() => {
        result.current.start({ content: 'first' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('error', {
          error: 'web_search_unavailable',
        });
        await Promise.resolve();
      });
      const infoCallsAfterFirst = mockEnqueueSnackbar.mock.calls.filter(
        (c) => c[1]?.variant === 'info',
      );
      expect(infoCallsAfterFirst.length).toBe(1);

      // Second marker — same session id. Retry path.
      act(() => {
        result.current.start({ content: 'retry' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[1].emit('init', {
          message_id: MESSAGE_ID,
          session_id: SESSION_ID,
          mode: 'auto',
        });
        MockStreamController.instances[1].emit('error', {
          error: 'web_search_unavailable',
        });
        await Promise.resolve();
      });

      const infoCallsAfterSecond = mockEnqueueSnackbar.mock.calls.filter(
        (c) => c[1]?.variant === 'info',
      );
      // Still 1 — dedupe absorbed the second occurrence.
      expect(infoCallsAfterSecond.length).toBe(1);
    });

    it('re-arms the snackbar when the session id changes', async () => {
      const { result, rerender } = renderHook(
        ({ sid }: { sid: string }) =>
          useSendMessageStream({ sessionId: sid }),
        { wrapper, initialProps: { sid: 'session-A' } },
      );

      // Marker on session A.
      act(() => {
        result.current.start({ content: 'hi A' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[0].emit('init', {
          message_id: MESSAGE_ID,
          session_id: 'session-A',
          mode: 'auto',
        });
        MockStreamController.instances[0].emit('error', {
          error: 'web_search_unavailable',
        });
        await Promise.resolve();
      });
      expect(
        mockEnqueueSnackbar.mock.calls.filter((c) => c[1]?.variant === 'info').length,
      ).toBe(1);

      // Switch to session B (new prop).
      rerender({ sid: 'session-B' });

      // Marker on session B → new entry in the set → snackbar fires again.
      act(() => {
        result.current.start({ content: 'hi B' });
      });
      await flush();
      await act(async () => {
        MockStreamController.instances[1].emit('init', {
          message_id: MESSAGE_ID,
          session_id: 'session-B',
          mode: 'auto',
        });
        MockStreamController.instances[1].emit('error', {
          error: 'web_search_unavailable',
        });
        await Promise.resolve();
      });
      const infoCalls = mockEnqueueSnackbar.mock.calls.filter(
        (c) => c[1]?.variant === 'info',
      );
      expect(infoCalls.length).toBe(2);
    });
  });

  it('malformed event JSON is ignored gracefully', async () => {
    const { result } = renderStreamHook();
    act(() => {
      result.current.start({ content: 'hi' });
    });
    await flush();

    await act(async () => {
      MockStreamController.instances[0].emit('init', '{"not valid json');
      await Promise.resolve();
    });

    expect(store.getState().chatBar.streamingAssistantMessage.id).toBeNull();
    expect(store.getState().chatBar.streamingAssistantMessage.isStreaming).toBe(
      false,
    );
  });
});
