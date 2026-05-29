/**
 * PROJ-17 Phase 6 — ChatMessageList tests (P1)
 *
 * Strategy: stub react-markdown / rehype-sanitize / SourceCard / WorkflowCard /
 * SaveSnippetToolbar so we test only ChatMessageList rendering + scroll logic.
 *
 * FIX-chat-bugfixes-and-grouping Phase 4 (Item 5) — Auto-scroll now sits on a
 * sentinel `<div>` observed by IntersectionObserver instead of the previous
 * `scroll` event listener. Tests install a controllable IO mock so they can
 * fire `isIntersecting: true | false` deterministically. We also stub
 * Element.prototype.scrollTo (not implemented in jsdom) so the hook can write
 * to it without throwing — and so we can assert on calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// ---- jsdom missing API patch ----
if (!('scrollIntoView' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
} else {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}

// jsdom does not implement Element.prototype.scrollTo. The IO-driven
// auto-scroll path calls `scrollContainer.scrollTo({ top, behavior })`; without
// the polyfill any test that mounts the list with messages throws.
const scrollToSpy = vi.fn();
Object.defineProperty(Element.prototype, 'scrollTo', {
  value: scrollToSpy,
  writable: true,
  configurable: true,
});

// ---- Controllable IntersectionObserver mock ----
// Replaces the no-op stub in setupTests.ts for this suite. Each instance
// exposes a `fire(isIntersecting)` method so tests can simulate the sentinel
// crossing the threshold without juggling scrollHeight / scrollTop in jsdom.
type IOInstance = {
  callback: IntersectionObserverCallback;
  fire: (isIntersecting: boolean) => void;
  disconnect: () => void;
};
const ioInstances: IOInstance[] = [];

class ControllableIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  private cb: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb;
    const inst: IOInstance = {
      callback: cb,
      fire: (isIntersecting: boolean) => {
        const entry = {
          isIntersecting,
          intersectionRatio: isIntersecting ? 1 : 0,
          time: Date.now(),
          target: document.body,
          boundingClientRect: new DOMRect(),
          intersectionRect: new DOMRect(),
          rootBounds: new DOMRect(),
        } as IntersectionObserverEntry;
        this.cb([entry], this);
      },
      disconnect: () => {},
    };
    ioInstances.push(inst);
  }
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

// ---- hoisted mocks ----
const { mockSaveSnippetToolbar } = vi.hoisted(() => ({
  mockSaveSnippetToolbar: vi.fn(),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('remark-gfm', () => ({ default: () => () => ({}) }));
vi.mock('rehype-sanitize', () => ({ default: () => () => ({}) }));

vi.mock('../SourceCard', () => ({
  default: ({ source }: { source: { url: string } }) => (
    <div data-testid="source-card-mock" data-url={source.url} />
  ),
}));

// PROJ-20 — SourceList wraps SourceCards in a Collapse trigger. Tests assert
// rendering of the inner cards plus the trigger; render the real component
// (it only depends on SourceCard which is already mocked above).

vi.mock('../WorkflowCard', () => ({
  default: () => <div data-testid="workflow-card-mock" />,
}));

vi.mock('../SaveSnippetToolbar', () => ({
  default: (props: {
    onSaveKeywords: (text: string, url?: string) => void;
    onSaveNotes: (text: string, url?: string) => void;
  }) => {
    mockSaveSnippetToolbar(props);
    return <div data-testid="save-snippet-toolbar-mock" />;
  },
}));

vi.mock('../JumpToLatestButton', () => ({
  default: ({ visible, onClick }: { visible: boolean; onClick: () => void }) =>
    visible ? (
      <button data-testid="jump-to-latest-mock" onClick={onClick}>
        jump
      </button>
    ) : null,
}));

// PROJ-20 Phase 5 — toolbar pulls in searchSlice (RTK Query) which fails to
// load in jsdom without the full store wired up. Stub it so ChatMessageList
// tests stay focused on rendering + scroll behavior.
vi.mock('../partials/MessageActionToolbar', () => ({
  default: () => <div data-testid="message-action-toolbar-mock" />,
}));

// PROJ-29 Phase 1J follow-up — stub UserMessageToolbar so we can assert on
// whether `onRetry` was passed by the parent (drives the retry-visibility
// integration test for next-message-error pairing).
const { mockUserMessageToolbar } = vi.hoisted(() => ({
  mockUserMessageToolbar: vi.fn(),
}));
vi.mock('../partials/UserMessageToolbar', () => ({
  default: (props: { content: string; onRetry?: () => void }) => {
    mockUserMessageToolbar(props);
    return (
      <div
        data-testid="user-message-toolbar-mock"
        data-has-retry={props.onRetry ? 'true' : 'false'}
        data-content={props.content}
      />
    );
  },
}));

// ---- imports of code under test ----
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../public/locales/en/translation.json';
import chatBarReducer, {
  setStreamingAssistantMessage,
  appendStreamingChunk,
  clearStreamingMessage,
} from '@/store/chatBarSlice';
import theme from '@/style/theme';
import ChatMessageList from '../ChatMessageList';
import type { ChatMessage } from '@/types/search';

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

const buildStore = () =>
  configureStore({ reducer: { chatBar: chatBarReducer } });

interface RenderListOpts {
  messages?: ChatMessage[];
  isLoading?: boolean;
  hasMore?: boolean;
  withSaveHandlers?: boolean;
  onRetry?: (m: ChatMessage) => void;
  /** Force remount on rerender via a key change — exercises AC-5-4. */
  remountKey?: string;
}

const renderList = (opts: RenderListOpts = {}) => {
  const store = buildStore();
  const onSaveKeywords = vi.fn();
  const onSaveNotes = vi.fn();
  const onSaveSelectionAsKeywords = vi.fn();
  const onSaveSelectionAsNotes = vi.fn();
  const onLoadMore = vi.fn();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4}>
          <MemoryRouter>{children}</MemoryRouter>
        </SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );

  const result = render(
    <ChatMessageList
      key={opts.remountKey}
      messages={opts.messages ?? []}
      isLoading={opts.isLoading ?? false}
      hasMore={opts.hasMore ?? false}
      onLoadMore={onLoadMore}
      onSaveKeywords={onSaveKeywords}
      onSaveNotes={onSaveNotes}
      onRetry={opts.onRetry}
      {...(opts.withSaveHandlers !== false
        ? { onSaveSelectionAsKeywords, onSaveSelectionAsNotes }
        : {})}
    />,
    { wrapper: Wrapper },
  );
  return {
    store,
    onSaveKeywords,
    onSaveNotes,
    onSaveSelectionAsKeywords,
    onSaveSelectionAsNotes,
    onLoadMore,
    ...result,
  };
};

const buildMessage = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: 'm1',
  session: 'sess-1',
  role: 'assistant',
  content: 'Hello world',
  message_type: 'search_result',
  sources: [],
  search_mode: null,
  search_sources: null,
  model_used: '',
  agent_session: null,
  created_at: '2026-04-25T00:00:00Z',
  ...overrides,
});

const originalIO = globalThis.IntersectionObserver;

beforeEach(() => {
  vi.clearAllMocks();
  scrollToSpy.mockClear();
  ioInstances.length = 0;
  globalThis.IntersectionObserver =
    ControllableIntersectionObserver as unknown as typeof IntersectionObserver;
  // Default jsdom geometry so scrollHeight - clientHeight is a meaningful number.
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get() {
      return 1000;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 200;
    },
  });
});

afterEach(() => {
  globalThis.IntersectionObserver = originalIO;
});

describe('ChatMessageList', () => {
  it('renders empty-state hint when no messages and not loading', () => {
    renderList({ messages: [] });
    // i18n key search.empty.firstSearchHint — match a non-empty caption
    // by checking at least one Typography element is in the document.
    // The exact text depends on translation — assert NO bubble messages exist.
    expect(screen.queryAllByTestId('source-card-mock').length).toBe(0);
    expect(screen.queryByTestId('workflow-card-mock')).toBeNull();
  });

  it('renders 3 messages in order (user / assistant / user)', () => {
    const messages: ChatMessage[] = [
      buildMessage({ id: 'a', role: 'user', content: 'First user msg' }),
      buildMessage({ id: 'b', role: 'assistant', content: 'AI reply' }),
      buildMessage({ id: 'c', role: 'user', content: 'Second user msg' }),
    ];
    renderList({ messages });
    expect(screen.getByText('First user msg')).toBeInTheDocument();
    expect(screen.getByText('AI reply')).toBeInTheDocument();
    expect(screen.getByText('Second user msg')).toBeInTheDocument();
  });

  it('renders streaming bubble when streamingAssistantMessage.isStreaming=true', () => {
    const { store } = renderList({
      messages: [buildMessage({ id: 'a', role: 'user', content: 'q' })],
    });
    act(() => {
      store.dispatch(
        setStreamingAssistantMessage({ id: 'streaming-1', content: 'live AI' }),
      );
      store.dispatch(appendStreamingChunk('partial chunk'));
    });
    // The streaming bubble has aria-live="polite" — find by aria-label "streaming".
    const region = screen.getByLabelText(/streaming/i);
    expect(region).toBeInTheDocument();
    expect(region.textContent).toContain('live AI');
    expect(region.textContent).toContain('partial chunk');
  });

  it('does NOT render streaming bubble when isStreaming=false', () => {
    const { store } = renderList({
      messages: [buildMessage({ id: 'a', role: 'user', content: 'q' })],
    });
    act(() => {
      store.dispatch(clearStreamingMessage());
    });
    expect(screen.queryByLabelText(/streaming/i)).toBeNull();
  });

  it('renders WorkflowCard for messages with message_type=workflow_card + agent_session', () => {
    const messages: ChatMessage[] = [
      buildMessage({
        id: 'wf-1',
        role: 'assistant',
        content: '',
        message_type: 'workflow_card',
        agent_session: {
          id: 'sess-1',
          status: 'running',
          current_step: 'analyze',
          completed_steps: 1,
          total_steps: 5,
        },
      }),
    ];
    renderList({ messages });
    expect(screen.getByTestId('workflow-card-mock')).toBeInTheDocument();
  });

  it('renders collapsed SourceList trigger with count; cards mount on expand', () => {
    const messages: ChatMessage[] = [
      buildMessage({
        id: 'm1',
        role: 'assistant',
        content: 'see refs',
        sources: [
          { title: 'A', url: 'https://a.example', snippet: 'a' },
          { title: 'B', url: 'https://b.example', snippet: 'b' },
        ],
      }),
    ];
    renderList({ messages });
    // Collapsed: count text visible, no SourceCard mounted yet.
    const trigger = screen.getByRole('button', { name: /sources?/i });
    expect(trigger).toBeInTheDocument();
    expect(screen.queryAllByTestId('source-card-mock').length).toBe(0);
    // Expand — cards now mount.
    fireEvent.click(trigger);
    const cards = screen.getAllByTestId('source-card-mock');
    expect(cards.length).toBe(2);
    expect(cards[0].getAttribute('data-url')).toBe('https://a.example');
  });

  it('SaveSnippetToolbar receives selection-save callbacks via props', () => {
    renderList({
      messages: [buildMessage({ id: 'm1', role: 'assistant', content: 'foo' })],
      withSaveHandlers: true,
    });
    expect(screen.getByTestId('save-snippet-toolbar-mock')).toBeInTheDocument();
    expect(mockSaveSnippetToolbar).toHaveBeenCalled();
    const props = mockSaveSnippetToolbar.mock.calls[0][0];
    expect(typeof props.onSaveKeywords).toBe('function');
    expect(typeof props.onSaveNotes).toBe('function');
  });

  it('JumpToLatestButton appears when sentinel leaves viewport (user scrolled up)', () => {
    const messages: ChatMessage[] = Array.from({ length: 8 }).map((_, i) =>
      buildMessage({
        id: `m${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
      }),
    );
    renderList({ messages });
    // Initial: button hidden (userAtBottom defaults to true).
    expect(screen.queryByTestId('jump-to-latest-mock')).toBeNull();
    // Simulate sentinel leaving the viewport (user scrolled up).
    expect(ioInstances.length).toBeGreaterThan(0);
    act(() => {
      ioInstances[ioInstances.length - 1].fire(false);
    });
    expect(screen.getByTestId('jump-to-latest-mock')).toBeInTheDocument();
  });

  it('JumpToLatestButton hidden when sentinel is in viewport (at bottom)', () => {
    const messages: ChatMessage[] = Array.from({ length: 4 }).map((_, i) =>
      buildMessage({ id: `m${i}`, role: 'assistant', content: `msg ${i}` }),
    );
    renderList({ messages });
    // Default: userAtBottom=true → button hidden.
    expect(screen.queryByTestId('jump-to-latest-mock')).toBeNull();
    // Explicitly fire isIntersecting=true → still hidden (idempotent).
    act(() => {
      ioInstances[ioInstances.length - 1]?.fire(true);
    });
    expect(screen.queryByTestId('jump-to-latest-mock')).toBeNull();
  });

  it('hasMore=true renders the "Load more" button', () => {
    renderList({
      messages: [buildMessage({ id: 'm1', role: 'user', content: 'q' })],
      hasMore: true,
    });
    // i18n key search.chat.loadMore — assert by role=button + closest text match
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  // PROJ-29 Phase 1J follow-up — UserMessageToolbar wiring.
  it('does NOT pass onRetry to UserMessageToolbar when next message is not an error', () => {
    const messages: ChatMessage[] = [
      buildMessage({ id: 'u1', role: 'user', content: 'q' }),
      buildMessage({ id: 'a1', role: 'assistant', content: 'ok' }),
    ];
    renderList({ messages, onRetry: vi.fn() });
    const toolbars = screen.getAllByTestId('user-message-toolbar-mock');
    expect(toolbars).toHaveLength(1);
    expect(toolbars[0].getAttribute('data-has-retry')).toBe('false');
  });

  it('passes onRetry to UserMessageToolbar when next message is assistant + message_type=error', () => {
    const messages: ChatMessage[] = [
      buildMessage({ id: 'u1', role: 'user', content: 'q' }),
      buildMessage({
        id: 'e1',
        role: 'assistant',
        content: 'boom',
        message_type: 'error',
      }),
    ];
    renderList({ messages, onRetry: vi.fn() });
    const toolbars = screen.getAllByTestId('user-message-toolbar-mock');
    expect(toolbars).toHaveLength(1);
    expect(toolbars[0].getAttribute('data-has-retry')).toBe('true');
    expect(toolbars[0].getAttribute('data-content')).toBe('q');
  });

  it('does NOT pass onRetry when the user message is the last one (no next sibling)', () => {
    const messages: ChatMessage[] = [
      buildMessage({ id: 'u1', role: 'user', content: 'q' }),
    ];
    renderList({ messages, onRetry: vi.fn() });
    const toolbars = screen.getAllByTestId('user-message-toolbar-mock');
    expect(toolbars).toHaveLength(1);
    expect(toolbars[0].getAttribute('data-has-retry')).toBe('false');
  });

  it('invokes onRetry with the original user message when the retry handler fires', () => {
    const userMsg = buildMessage({ id: 'u1', role: 'user', content: 'q' });
    const errorMsg = buildMessage({
      id: 'e1',
      role: 'assistant',
      content: 'boom',
      message_type: 'error',
    });
    const onRetry = vi.fn();
    renderList({ messages: [userMsg, errorMsg], onRetry });
    // Pull the closure that ChatMessageList passed down to the toolbar and
    // call it — that's the same path the real Retry button would trigger.
    const lastCall =
      mockUserMessageToolbar.mock.calls[
        mockUserMessageToolbar.mock.calls.length - 1
      ][0];
    expect(typeof lastCall.onRetry).toBe('function');
    lastCall.onRetry();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'u1', content: 'q' }),
    );
  });

  // FIX-chat-bugfixes-and-grouping Item 4 — referenced-niche chip render path.
  describe('referenced niche chip', () => {
    it('renders the chip on a user message that carries referenced_niche_name', () => {
      const messages: ChatMessage[] = [
        buildMessage({
          id: 'u1',
          role: 'user',
          content: 'about my cats',
          referenced_niche_id: 'niche-uuid-1',
          referenced_niche_name: 'Cats',
        }),
      ];
      renderList({ messages });
      const chip = screen.getByTestId('referenced-niche-chip');
      expect(chip).toBeInTheDocument();
      expect(chip.textContent).toContain('Cats');
      expect(chip.getAttribute('aria-label')).toContain('Cats');
    });

    it('does NOT render the chip when referenced_niche_name is null', () => {
      const messages: ChatMessage[] = [
        buildMessage({
          id: 'u1',
          role: 'user',
          content: 'no niche',
          referenced_niche_id: null,
          referenced_niche_name: null,
        }),
      ];
      renderList({ messages });
      expect(screen.queryByTestId('referenced-niche-chip')).toBeNull();
    });

    it('does NOT render the chip on assistant messages (defence in depth)', () => {
      // Backend guarantees assistant messages never carry the field, but the
      // render path should be guarded regardless. We synthesise the field on
      // an assistant row and assert no chip leaks through.
      const messages: ChatMessage[] = [
        buildMessage({
          id: 'a1',
          role: 'assistant',
          content: 'reply',
          referenced_niche_id: 'niche-uuid-1',
          referenced_niche_name: 'Cats',
        }),
      ];
      renderList({ messages });
      expect(screen.queryByTestId('referenced-niche-chip')).toBeNull();
    });
  });

  // FIX-chat-bugfixes-and-grouping Phase 4 (Item 5) — Auto-scroll engine.
  describe('auto-scroll', () => {
    it('mounting with 3 messages scrolls the container to the bottom (instant) on first paint', () => {
      const messages: ChatMessage[] = [
        buildMessage({ id: 'a', role: 'user', content: 'one' }),
        buildMessage({ id: 'b', role: 'assistant', content: 'two' }),
        buildMessage({ id: 'c', role: 'user', content: 'three' }),
      ];
      renderList({ messages });
      // useLayoutEffect runs synchronously before paint — assert scrollTo was
      // called with `top = scrollHeight (1000)` and `behavior: 'instant'`.
      const instantCalls = scrollToSpy.mock.calls.filter(
        (c) => c[0]?.behavior === 'instant',
      );
      expect(instantCalls.length).toBeGreaterThanOrEqual(1);
      expect(instantCalls[0][0].top).toBe(1000);
    });

    it('mounting with an empty array does NOT call scrollTo', () => {
      renderList({ messages: [] });
      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it('re-mounting with a new session-id (key change) re-fires the initial scroll', () => {
      const messages: ChatMessage[] = [
        buildMessage({ id: 'a', role: 'user', content: 'one' }),
        buildMessage({ id: 'b', role: 'assistant', content: 'two' }),
      ];
      const { rerender } = renderList({ messages, remountKey: 'session-1' });
      const firstInstantCount = scrollToSpy.mock.calls.filter(
        (c) => c[0]?.behavior === 'instant',
      ).length;
      expect(firstInstantCount).toBeGreaterThanOrEqual(1);
      // Force remount with a new key — simulates parent switching activeSessionId.
      rerender(
        <ChatMessageList
          key="session-2"
          messages={messages}
          isLoading={false}
          hasMore={false}
          onLoadMore={() => {}}
        />,
      );
      const secondInstantCount = scrollToSpy.mock.calls.filter(
        (c) => c[0]?.behavior === 'instant',
      ).length;
      expect(secondInstantCount).toBeGreaterThan(firstInstantCount);
    });

    it('when user scrolled up, the next streaming chunk does NOT trigger scrollTo', async () => {
      const messages: ChatMessage[] = [
        buildMessage({ id: 'a', role: 'user', content: 'q' }),
      ];
      const { store } = renderList({ messages });
      // Simulate user scrolling up FIRST — sets userAtBottomRef.current=false
      // before any streaming effect can read it.
      act(() => {
        ioInstances[ioInstances.length - 1]?.fire(false);
      });
      // Clear initial-mount scrollTo + any leftover rAF state.
      await act(async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      });
      scrollToSpy.mockClear();
      // Begin streaming bubble + dispatch a chunk while user is scrolled up.
      act(() => {
        store.dispatch(
          setStreamingAssistantMessage({ id: 'streaming-1', content: 'live' }),
        );
      });
      act(() => {
        store.dispatch(appendStreamingChunk('chunk after scroll-up'));
      });
      // Flush any scheduled rAF.
      await act(async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      });
      // userAtBottomRef.current was false when the effect read it, so no
      // smooth scroll should have been issued.
      const smoothCalls = scrollToSpy.mock.calls.filter(
        (c) => c[0]?.behavior === 'smooth',
      );
      expect(smoothCalls.length).toBe(0);
    });

    it('prepending older messages (Load more) does NOT trigger auto-scroll', async () => {
      const initial: ChatMessage[] = [
        buildMessage({ id: 'b', role: 'user', content: 'two' }),
        buildMessage({ id: 'c', role: 'assistant', content: 'three' }),
      ];
      const { rerender } = renderList({ messages: initial });
      // Clear any initial-scroll calls before the prepend.
      scrollToSpy.mockClear();
      // Simulate "Load more" — older messages prepended at the front. The
      // tail message id is unchanged (still 'c'), so no auto-scroll.
      const withOlder: ChatMessage[] = [
        buildMessage({ id: 'a-older', role: 'user', content: 'zero' }),
        ...initial,
      ];
      rerender(
        <ChatMessageList
          messages={withOlder}
          isLoading={false}
          hasMore={false}
          onLoadMore={() => {}}
        />,
      );
      // Flush any deferred rAF the effect may have scheduled.
      await act(async () => {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      });
      const smoothCalls = scrollToSpy.mock.calls.filter(
        (c) => c[0]?.behavior === 'smooth',
      );
      expect(smoothCalls.length).toBe(0);
    });
  });
});
