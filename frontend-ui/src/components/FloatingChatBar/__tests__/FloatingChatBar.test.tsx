/**
 * PROJ-17 Phase 6 — FloatingChatBar tests (P1)
 * PROJ-20 Phase 3.3 — partial-wire update
 *
 * The legacy `<ChatBarInput>` (with TextField + Send) was replaced by
 * `<ChatInputBar appearance="floating" />`, which uses a contenteditable
 * SmartTextarea and a disabled Send button (deferred to Phase 3.7).
 *
 * Tests covering "Send", "input value", and "agent / auto routing" were
 * removed: that wiring lives in ChatInputBar now and will gain back its
 * tests in Phase 3.7. Tests covering expand/collapse/persist/glasmorphism
 * still apply and are kept.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// ---- hoisted mocks ----
const { mockUseSearchHealth } = vi.hoisted(() => ({
  mockUseSearchHealth: vi.fn(),
}));

vi.mock('@/store/searchSlice', () => ({
  searchApi: {
    reducerPath: 'searchApi',
    util: { invalidateTags: vi.fn(() => ({ type: 'noop' })) },
  },
  useCreateSessionMutation: () => [vi.fn(), { isLoading: false }],
  useSendMessageMutation: () => [vi.fn(), { isLoading: false }],
  useGetSessionQuery: () => ({ data: undefined, isLoading: false }),
  useListSessionsQuery: () => ({ data: { count: 0, results: [] }, isLoading: false }),
  useHealthCheckQuery: () => ({
    data: { vane: 'online', crawl4ai: 'online' },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/store/nicheSlice', () => ({
  nicheApi: {
    reducerPath: 'nicheApi',
    util: { invalidateTags: vi.fn(() => ({ type: 'noop' })) },
  },
  useListNichesQuery: () => ({ data: { count: 0, results: [] }, isLoading: false }),
  // PROJ-20 Phase 3.7: useNicheChipSync (mounted inside ChatInputBar) calls
  // useGetNicheQuery — return a benign no-op shape since these tests don't
  // exercise auto-prefill.
  useGetNicheQuery: () => ({
    data: undefined,
    isError: false,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useSendMessageStream', () => ({
  useSendMessageStream: () => ({
    start: vi.fn(),
    stop: vi.fn(),
    isStreaming: false,
  }),
}));

vi.mock('../../MultiPurposeDrawer/hooks/useSearchHealth', () => ({
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
import enTranslation from '../../../../public/locales/en/translation.json';
import chatBarReducer from '@/store/chatBarSlice';
import theme from '@/style/theme';
import FloatingChatBar from '../index';

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

// ---- notistack capture ----
const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar, closeSnackbar: vi.fn() }),
  };
});

// ---- store factory ----
const buildStore = () =>
  configureStore({
    reducer: { chatBar: chatBarReducer },
  });

const renderBar = () => {
  const store = buildStore();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4}>
          <MemoryRouter>{children}</MemoryRouter>
        </SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );
  return { store, ...render(<FloatingChatBar />, { wrapper: Wrapper }) };
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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
});

describe('FloatingChatBar', () => {
  it('initial state collapsed: only chevron rendered, no input', () => {
    renderBar();
    // Chevron acts as a button with the localized aria-label "Open search"
    expect(screen.getByRole('button', { name: /open search/i })).toBeInTheDocument();
    // No input present in collapsed state
    expect(screen.queryByTestId('chat-input-editable')).not.toBeInTheDocument();
  });

  it('chevron click expands the bar — ChatInputBar becomes visible', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: /open search/i }));
    expect(await screen.findByTestId('chat-input-editable')).toBeInTheDocument();
  });

  it('close-chevron in expanded state collapses the bar again', async () => {
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    expect(await screen.findByTestId('chat-input-editable')).toBeInTheDocument();
    const collapseBtn = screen.getByRole('button', { name: /collapse/i });
    await user.click(collapseBtn);
    await waitFor(() =>
      expect(screen.queryByTestId('chat-input-editable')).not.toBeInTheDocument(),
    );
  });

  it('localStorage persists expanded state after expand → "true"', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: /open search/i }));
    await waitFor(() =>
      expect(localStorage.getItem('chatBar.expanded')).toBe('true'),
    );
  });

  it('localStorage persists collapsed state after collapse → "false"', async () => {
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    const collapseBtn = await screen.findByRole('button', { name: /collapse/i });
    await user.click(collapseBtn);
    await waitFor(() =>
      expect(localStorage.getItem('chatBar.expanded')).toBe('false'),
    );
  });

  it('restores expanded state on mount when LS pre-set to "true"', async () => {
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    expect(await screen.findByTestId('chat-input-editable')).toBeInTheDocument();
  });

  /** Helper: dump all emotion <style> rules in head as a single string. */
  const collectStyleSheets = () => {
    const styles = Array.from(document.head.querySelectorAll('style'));
    return styles.map((s) => s.textContent ?? '').join('\n');
  };

  it('glasmorphism styles: backdrop-filter blur applied to expanded surface', async () => {
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    await screen.findByTestId('chat-input-editable');
    const css = collectStyleSheets();
    expect(css.includes('backdrop-filter') && css.includes('blur')).toBe(true);
  });

  it('bottom-center position: BarContainer uses left:50% + translateX(-50%)', async () => {
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    await screen.findByTestId('chat-input-editable');
    const css = collectStyleSheets();
    expect(css.includes('left:50%') || css.includes('left: 50%')).toBe(true);
    expect(css.includes('translateX')).toBe(true);
  });
});
