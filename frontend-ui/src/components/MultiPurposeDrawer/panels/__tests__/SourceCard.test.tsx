/**
 * PROJ-17 Phase 6 — SourceCard tests
 *
 * Strategy: stub searchSlice mutations + queries via vi.mock so we can drive
 * crawl trigger + crawl status updates without hitting the network.
 *
 * Phase 2 rename: legacy `nicheContext { id, name }` →
 * new `inputChip { niche_id, niche_name }`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// ---- hoisted mocks ----
const {
  mockTriggerCrawl,
  mockUseGetCrawlStatus,
  mockUseSearchHealth,
} = vi.hoisted(() => ({
  mockTriggerCrawl: vi.fn(),
  mockUseGetCrawlStatus: vi.fn(),
  mockUseSearchHealth: vi.fn(),
}));

vi.mock('@/store/searchSlice', () => ({
  searchApi: {
    reducerPath: 'searchApi',
    util: { invalidateTags: vi.fn(() => ({ type: 'noop' })) },
  },
  useTriggerCrawlMutation: () => [mockTriggerCrawl, { isLoading: false }],
  useGetCrawlStatusQuery: (id: string, opts?: { skip?: boolean }) =>
    mockUseGetCrawlStatus(id, opts),
}));

vi.mock('../../hooks/useSearchHealth', () => ({
  useSearchHealth: () => mockUseSearchHealth(),
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
  setInputChip,
  type InputChip,
} from '@/store/chatBarSlice';
import theme from '@/style/theme';
import SourceCard from '../SourceCard';
import type { SourceItem } from '@/types/search';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const buildStore = (inputChip?: InputChip | null) => {
  const store = configureStore({ reducer: { chatBar: chatBarReducer } });
  if (inputChip !== undefined) {
    store.dispatch(setInputChip(inputChip));
  }
  return store;
};

interface RenderOpts {
  source: SourceItem;
  inputChip?: InputChip | null;
  onSaveKeywords?: (url: string, snippet: string) => void;
  onSaveNotes?: (url: string, snippet: string) => void;
  crawlResultId?: string;
}

const renderCard = (opts: RenderOpts) => {
  const store = buildStore(opts.inputChip);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4}>
          <MemoryRouter>{children}</MemoryRouter>
        </SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );
  return {
    store,
    ...render(
      <SourceCard
        source={opts.source}
        crawlResultId={opts.crawlResultId}
        onSaveKeywords={opts.onSaveKeywords}
        onSaveNotes={opts.onSaveNotes}
      />,
      { wrapper: Wrapper },
    ),
  };
};

const baseSource: SourceItem = {
  url: 'https://example.com/article-1',
  title: 'Example Article Title',
  snippet: 'A short snippet text describing the article content.',
};

describe('SourceCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchHealth.mockReturnValue({
      health: { vane: 'online', crawl4ai: 'online' },
      isLoading: false,
      isError: false,
      vaneOnline: true,
      crawl4aiOnline: true,
      allOnline: true,
      allOffline: false,
      partial: false,
      statusColor: 'success',
    });
    mockUseGetCrawlStatus.mockReturnValue({ data: undefined, isLoading: false });
    mockTriggerCrawl.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ id: 'crawl-1' }),
    });
  });

  it('renders favicon with Google s2 favicons URL pattern (correct domain)', () => {
    renderCard({ source: baseSource });
    const img = screen.getByAltText('example.com') as HTMLImageElement;
    expect(img.src).toContain('https://www.google.com/s2/favicons');
    expect(img.src).toContain(encodeURIComponent('example.com'));
  });

  it('renders title and snippet visible', () => {
    renderCard({ source: baseSource });
    expect(screen.getByText('Example Article Title')).toBeInTheDocument();
    expect(
      screen.getByText(/A short snippet text describing/),
    ).toBeInTheDocument();
  });

  it('root element has data-source-url attribute set to source URL', () => {
    const { container } = renderCard({ source: baseSource });
    const root = container.querySelector('[data-source-url]') as HTMLElement;
    expect(root).toBeTruthy();
    expect(root.getAttribute('data-source-url')).toBe(baseSource.url);
  });

  it('clicking Deep Crawl button triggers useTriggerCrawlMutation', async () => {
    const user = userEvent.setup();
    renderCard({ source: baseSource });
    // MUI Tooltip wraps the IconButton in a <span aria-label="Deep Crawl">,
    // so two elements share the label. Use role=button to disambiguate.
    const btn = screen.getByRole('button', { name: 'Deep Crawl' });
    await user.click(btn);
    expect(mockTriggerCrawl).toHaveBeenCalledWith({
      url: baseSource.url,
      chat_message_id: undefined,
    });
  });

  it('Deep Crawl button disabled when crawl4ai is offline', () => {
    mockUseSearchHealth.mockReturnValue({
      health: { vane: 'online', crawl4ai: 'offline' },
      isLoading: false,
      isError: false,
      vaneOnline: true,
      crawl4aiOnline: false,
      allOnline: false,
      allOffline: false,
      partial: true,
      statusColor: 'warning',
    });
    renderCard({ source: baseSource });
    expect(screen.getByRole('button', { name: 'Deep Crawl' })).toBeDisabled();
  });

  it('Save Keywords button calls onSaveKeywords handler', async () => {
    const onSaveKeywords = vi.fn();
    const user = userEvent.setup();
    renderCard({
      source: baseSource,
      onSaveKeywords,
      inputChip: { niche_id: 'n1', niche_name: 'Cats' },
    });
    const btn = screen.getByRole('button', { name: 'Save Keywords' });
    await user.click(btn);
    expect(onSaveKeywords).toHaveBeenCalledWith(baseSource.url, baseSource.snippet);
  });

  it('Save Notes button calls onSaveNotes handler', async () => {
    const onSaveNotes = vi.fn();
    const user = userEvent.setup();
    renderCard({ source: baseSource, onSaveNotes });
    const btn = screen.getByRole('button', { name: /notes/i });
    await user.click(btn);
    expect(onSaveNotes).toHaveBeenCalledWith(baseSource.url, baseSource.snippet);
  });

  it('Save Keywords button NOT rendered when onSaveKeywords prop missing', () => {
    renderCard({ source: baseSource });
    expect(
      screen.queryByRole('button', { name: 'Save Keywords' }),
    ).not.toBeInTheDocument();
  });

  it('crawl status "pending" shows pending badge', () => {
    mockUseGetCrawlStatus.mockReturnValue({
      data: { id: 'crawl-1', crawl_status: 'pending' },
      isLoading: false,
    });
    renderCard({ source: baseSource, crawlResultId: 'crawl-1' });
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('crawl status "completed" shows completed badge with success indicator', () => {
    mockUseGetCrawlStatus.mockReturnValue({
      data: { id: 'crawl-1', crawl_status: 'completed' },
      isLoading: false,
    });
    renderCard({ source: baseSource, crawlResultId: 'crawl-1' });
    expect(screen.getByText('Crawled')).toBeInTheDocument();
  });

  it('triggers crawl status query when crawlResultId provided', async () => {
    mockUseGetCrawlStatus.mockReturnValue({
      data: { id: 'crawl-2', crawl_status: 'running' },
      isLoading: false,
    });
    renderCard({ source: baseSource, crawlResultId: 'crawl-2' });
    await waitFor(() => {
      expect(mockUseGetCrawlStatus).toHaveBeenCalled();
    });
    // First arg is the crawl id when query is active
    const callArgs = mockUseGetCrawlStatus.mock.calls[0];
    expect(callArgs[0]).toBe('crawl-2');
  });
});
