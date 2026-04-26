/**
 * PROJ-17 Phase 6 — ContextToggle tests
 *
 * Strategy: render ContextToggle with a custom store that includes the
 * chatBar slice. Drive `nicheContext` state via dispatched actions and
 * verify the toggle/Chip render correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { MemoryRouter } from 'react-router-dom';
import { render } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../public/locales/en/translation.json';
import chatBarReducer, { setNicheContext } from '@/store/chatBarSlice';
import theme from '@/style/theme';
import ContextToggle from '../ContextToggle';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const buildStore = (preload?: { nicheContext?: { id: string; name: string } | null }) => {
  const store = configureStore({
    reducer: {
      chatBar: chatBarReducer,
    },
  });
  if (preload?.nicheContext !== undefined) {
    store.dispatch(setNicheContext(preload.nicheContext));
  }
  return store;
};

const renderToggle = (
  candidateNiche: { id: string; name: string } | null,
  preload?: Parameters<typeof buildStore>[0],
) => {
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
  return {
    store,
    ...render(<ContextToggle candidateNiche={candidateNiche} />, { wrapper: Wrapper }),
  };
};

describe('ContextToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders switch unchecked when no niche context active', () => {
    renderToggle({ id: 'niche-1', name: 'Cats' });
    const sw = screen.getByRole('switch');
    expect(sw).not.toBeChecked();
  });

  it('renders switch checked when niche context matches candidate', () => {
    renderToggle(
      { id: 'niche-1', name: 'Cats' },
      { nicheContext: { id: 'niche-1', name: 'Cats' } },
    );
    const sw = screen.getByRole('switch');
    expect(sw).toBeChecked();
  });

  it('clicking toggle ON dispatches setNicheContext with candidate', async () => {
    const user = userEvent.setup();
    const { store } = renderToggle({ id: 'niche-2', name: 'Dogs' });
    expect(store.getState().chatBar.nicheContext).toBeNull();

    const sw = screen.getByRole('switch');
    await user.click(sw);

    expect(store.getState().chatBar.nicheContext).toEqual({
      id: 'niche-2',
      name: 'Dogs',
    });
  });

  it('clicking toggle OFF dispatches setNicheContext(null)', async () => {
    const user = userEvent.setup();
    const { store } = renderToggle(
      { id: 'niche-3', name: 'Fitness' },
      { nicheContext: { id: 'niche-3', name: 'Fitness' } },
    );
    expect(store.getState().chatBar.nicheContext).not.toBeNull();

    const sw = screen.getByRole('switch');
    await user.click(sw);

    expect(store.getState().chatBar.nicheContext).toBeNull();
  });

  it('shows niche name (disabled style) when toggle OFF', () => {
    renderToggle({ id: 'niche-4', name: 'Hiking' });
    expect(screen.getByText('Hiking')).toBeInTheDocument();
    // Chip should NOT be present when disabled (chip has delete button)
    expect(screen.queryByTestId('CancelIcon')).not.toBeInTheDocument();
  });

  it('shows MUI Chip with niche name when toggle ON', () => {
    renderToggle(
      { id: 'niche-5', name: 'Yoga' },
      { nicheContext: { id: 'niche-5', name: 'Yoga' } },
    );
    expect(screen.getByText('Yoga')).toBeInTheDocument();
    // Chip in "ON" state has a delete handler (X button)
    expect(screen.getByTestId('CancelIcon')).toBeInTheDocument();
  });

  it('returns null when candidateNiche is null (component hidden)', () => {
    const { container } = renderToggle(null);
    expect(container.firstChild).toBeNull();
  });

  it('clicking Chip delete (X) dispatches setNicheContext(null)', async () => {
    const user = userEvent.setup();
    const { store } = renderToggle(
      { id: 'niche-6', name: 'Coffee' },
      { nicheContext: { id: 'niche-6', name: 'Coffee' } },
    );
    const deleteIcon = screen.getByTestId('CancelIcon');
    await user.click(deleteIcon);
    expect(store.getState().chatBar.nicheContext).toBeNull();
  });

  it('label "Use this Niche as chat context" rendered', () => {
    renderToggle({ id: 'niche-7', name: 'Pets' });
    expect(screen.getByText('Use this Niche as chat context')).toBeInTheDocument();
  });
});
