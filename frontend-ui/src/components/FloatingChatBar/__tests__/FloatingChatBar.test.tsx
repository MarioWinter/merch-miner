/**
 * PROJ-17 Phase 6 — FloatingChatBar tests (P1)
 *
 * Strategy: stub searchSlice + nicheSlice (avoid axiosBaseQuery → authService → store
 * circular import). Mock useSendMessageStream and useSearchHealth so we can drive
 * Agent vs auto routing and offline states deterministically. localStorage is the
 * default jsdom one — we set/clear `chatBar.expanded` to verify persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// ---- hoisted mocks ----
const {
  mockCreateSession,
  mockSendMessage,
  mockStartStream,
  mockStopStream,
  mockUseSearchHealth,
} = vi.hoisted(() => ({
  mockCreateSession: vi.fn(),
  mockSendMessage: vi.fn(),
  mockStartStream: vi.fn(),
  mockStopStream: vi.fn(),
  mockUseSearchHealth: vi.fn(),
}));

vi.mock('@/store/searchSlice', () => ({
  searchApi: {
    reducerPath: 'searchApi',
    util: { invalidateTags: vi.fn(() => ({ type: 'noop' })) },
  },
  useCreateSessionMutation: () => [mockCreateSession, { isLoading: false }],
  useSendMessageMutation: () => [mockSendMessage, { isLoading: false }],
  useGetSessionQuery: () => ({ data: undefined, isLoading: false }),
  useListSessionsQuery: () => ({ data: { count: 0, results: [] }, isLoading: false }),
  useHealthCheckQuery: () => ({ data: undefined, isLoading: false, isError: false }),
}));

vi.mock('@/store/nicheSlice', () => ({
  nicheApi: {
    reducerPath: 'nicheApi',
    util: { invalidateTags: vi.fn(() => ({ type: 'noop' })) },
  },
  useListNichesQuery: () => ({ data: { count: 0, results: [] }, isLoading: false }),
}));

vi.mock('@/hooks/useSendMessageStream', () => ({
  useSendMessageStream: () => ({
    start: mockStartStream,
    stop: mockStopStream,
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
import chatBarReducer, { setModeOverride } from '@/store/chatBarSlice';
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
const buildStore = (preload?: { modeOverride?: 'auto' | 'web_search' | 'agent' }) => {
  const store = configureStore({
    reducer: { chatBar: chatBarReducer },
  });
  if (preload?.modeOverride) {
    store.dispatch(setModeOverride(preload.modeOverride));
  }
  return store;
};

const renderBar = (preload?: Parameters<typeof buildStore>[0]) => {
  const store = buildStore(preload);
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
    // No text input present in the collapsed state
    expect(screen.queryByPlaceholderText(/Search the web/i)).not.toBeInTheDocument();
  });

  it('chevron click expands the bar — input becomes visible', async () => {
    const user = userEvent.setup();
    renderBar();
    await user.click(screen.getByRole('button', { name: /open search/i }));
    expect(
      await screen.findByPlaceholderText(/Search the web/i),
    ).toBeInTheDocument();
  });

  it('close-chevron in expanded state collapses the bar again', async () => {
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    // Bar should be expanded after mount restored from LS
    expect(
      await screen.findByPlaceholderText(/Search the web/i),
    ).toBeInTheDocument();
    // Click the inner collapse-chevron at the top of expanded surface
    const collapseBtn = screen.getByRole('button', { name: /collapse/i });
    await user.click(collapseBtn);
    await waitFor(() =>
      expect(
        screen.queryByPlaceholderText(/Search the web/i),
      ).not.toBeInTheDocument(),
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
    expect(
      await screen.findByPlaceholderText(/Search the web/i),
    ).toBeInTheDocument();
  });

  /** Helper: dump all emotion <style> rules in head as a single string. */
  const collectStyleSheets = () => {
    const styles = Array.from(document.head.querySelectorAll('style'));
    return styles.map((s) => s.textContent ?? '').join('\n');
  };

  it('glasmorphism styles: backdrop-filter blur applied to expanded surface', async () => {
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    await screen.findByPlaceholderText(/Search the web/i);
    const css = collectStyleSheets();
    // styled(ExpandedSurface) emits `backdrop-filter: blur(16px)` via emotion
    expect(css.includes('backdrop-filter') && css.includes('blur')).toBe(true);
  });

  it('bottom-center position: BarContainer uses left:50% + translateX(-50%)', async () => {
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    await screen.findByPlaceholderText(/Search the web/i);
    const css = collectStyleSheets();
    expect(css.includes('left:50%') || css.includes('left: 50%')).toBe(true);
    expect(css.includes('translateX')).toBe(true);
  });

  it('typing in the input updates the local state and enables Send', async () => {
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    const input = await screen.findByPlaceholderText(/Search the web/i);
    await user.type(input, 'POD niches');
    expect((input as HTMLInputElement).value).toBe('POD niches');
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });

  it('agent mode submit calls sendMessage mutation, NOT stream', async () => {
    mockCreateSession.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ id: 'new-sess-1' }),
    });
    mockSendMessage.mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar({ modeOverride: 'agent' });
    const input = await screen.findByPlaceholderText(/Search the web/i);
    await user.type(input, 'analyze niche');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalledTimes(1));
    expect(mockStartStream).not.toHaveBeenCalled();
  });

  it('auto mode submit calls SSE stream with sessionIdOverride', async () => {
    mockCreateSession.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ id: 'new-sess-2' }),
    });
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar({ modeOverride: 'auto' });
    const input = await screen.findByPlaceholderText(/Search the web/i);
    await user.type(input, 'best POD niches');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(mockStartStream).toHaveBeenCalledTimes(1));
    expect(mockStartStream).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'best POD niches',
        mode_override: 'auto',
        sessionIdOverride: 'new-sess-2',
      }),
    );
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it('input is cleared after a successful send', async () => {
    mockCreateSession.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({ id: 'sess-x' }),
    });
    const user = userEvent.setup();
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar({ modeOverride: 'auto' });
    const input = (await screen.findByPlaceholderText(
      /Search the web/i,
    )) as HTMLInputElement;
    await user.type(input, 'test message');
    await user.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(input.value).toBe(''));
  });

  it('renders HealthStatusDot inside the expanded bar (status indicator visible)', async () => {
    localStorage.setItem('chatBar.expanded', 'true');
    renderBar();
    await screen.findByPlaceholderText(/Search the web/i);
    // HealthStatusDot has role=status when health resolved
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
