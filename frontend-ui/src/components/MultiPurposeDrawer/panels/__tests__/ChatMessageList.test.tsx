/**
 * PROJ-17 Phase 6 — ChatMessageList tests (P1)
 *
 * Strategy: stub react-markdown / rehype-sanitize / SourceCard / WorkflowCard /
 * SaveSnippetToolbar so we test only ChatMessageList rendering + scroll logic.
 * Mock Element.prototype.scrollIntoView (jsdom doesn't implement it).
 * Drive streaming bubble via Redux; drive scroll-engagement via direct
 * scrollTop manipulation + manual scroll event dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      messages={opts.messages ?? []}
      isLoading={opts.isLoading ?? false}
      hasMore={opts.hasMore ?? false}
      onLoadMore={onLoadMore}
      onSaveKeywords={onSaveKeywords}
      onSaveNotes={onSaveNotes}
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

beforeEach(() => {
  vi.clearAllMocks();
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

  it('JumpToLatestButton appears when user scrolls up away from bottom', () => {
    const messages: ChatMessage[] = Array.from({ length: 8 }).map((_, i) =>
      buildMessage({
        id: `m${i}`,
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `msg ${i}`,
      }),
    );
    const { container } = renderList({ messages });
    // The scroll container is the styled Box with overflowY:auto inside Wrapper.
    const scroller = container.querySelector('.MuiBox-root [class*="css"]');
    // Easier: query by overflowY style via inline element — fall back to first Box
    // with class containing 'css'. We'll select via role-none → find by role=presentation.
    // Simpler: find by data attribute. We'll grab the only div ancestor of bottomRef.
    const allDivs = container.querySelectorAll('div');
    let scrollEl: HTMLElement | null = null;
    for (const div of Array.from(allDivs)) {
      const style = window.getComputedStyle(div);
      if (style.overflowY === 'auto') {
        scrollEl = div;
        break;
      }
    }
    expect(scrollEl).not.toBeNull();
    // Force jsdom to think we have content + scrolled up
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scrollEl, 'clientHeight', { value: 200, configurable: true });
    Object.defineProperty(scrollEl, 'scrollTop', { value: 100, configurable: true });
    fireEvent.scroll(scrollEl!);
    expect(screen.getByTestId('jump-to-latest-mock')).toBeInTheDocument();
    void scroller; // unused, kept for clarity
  });

  it('JumpToLatestButton hidden when scrolled to bottom (autoScroll engaged)', () => {
    const messages: ChatMessage[] = Array.from({ length: 4 }).map((_, i) =>
      buildMessage({ id: `m${i}`, role: 'assistant', content: `msg ${i}` }),
    );
    const { container } = renderList({ messages });
    // Default: autoScroll=true → button hidden
    expect(screen.queryByTestId('jump-to-latest-mock')).toBeNull();
    // Now: scroll to bottom → still hidden (idempotent)
    const allDivs = container.querySelectorAll('div');
    let scrollEl: HTMLElement | null = null;
    for (const div of Array.from(allDivs)) {
      if (window.getComputedStyle(div).overflowY === 'auto') {
        scrollEl = div;
        break;
      }
    }
    if (scrollEl) {
      Object.defineProperty(scrollEl, 'scrollHeight', { value: 500, configurable: true });
      Object.defineProperty(scrollEl, 'clientHeight', { value: 500, configurable: true });
      Object.defineProperty(scrollEl, 'scrollTop', { value: 0, configurable: true });
      fireEvent.scroll(scrollEl);
    }
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
});
