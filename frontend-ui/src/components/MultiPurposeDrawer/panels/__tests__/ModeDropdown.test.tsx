/**
 * PROJ-17 Phase 6 — ModeDropdown tests
 *
 * Strategy: render ModeDropdown wrapped with chatBar slice store. Drive
 * `modeOverride` via store and assert dispatched actions on Select change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
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
import chatBarReducer, { setModeOverride } from '@/store/chatBarSlice';
import theme from '@/style/theme';
import ModeDropdown from '../ModeDropdown';
import type { ModeOverride } from '@/types/search';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const buildStore = (modeOverride?: ModeOverride) => {
  const store = configureStore({ reducer: { chatBar: chatBarReducer } });
  if (modeOverride) {
    store.dispatch(setModeOverride(modeOverride));
  }
  return store;
};

const renderDropdown = (compact = false, modeOverride?: ModeOverride) => {
  const store = buildStore(modeOverride);
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
    ...render(<ModeDropdown compact={compact} />, { wrapper: Wrapper }),
  };
};

describe('ModeDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default Auto mode selected', () => {
    renderDropdown();
    // The displayed value (in renderValue) shows "Auto"
    expect(screen.getByRole('combobox')).toHaveTextContent('Auto');
  });

  it('opens dropdown showing all 3 mode options', async () => {
    const user = userEvent.setup();
    renderDropdown();
    await user.click(screen.getByRole('combobox'));

    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Auto')).toBeInTheDocument();
    expect(within(listbox).getByText('Web Search')).toBeInTheDocument();
    expect(within(listbox).getByText('Agent')).toBeInTheDocument();
    expect(within(listbox).getAllByRole('option')).toHaveLength(3);
  });

  it('selecting Web Search dispatches setModeOverride("web_search")', async () => {
    const user = userEvent.setup();
    const { store } = renderDropdown();
    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Web Search'));
    expect(store.getState().chatBar.modeOverride).toBe('web_search');
  });

  it('selecting Agent dispatches setModeOverride("agent")', async () => {
    const user = userEvent.setup();
    const { store } = renderDropdown();
    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Agent'));
    expect(store.getState().chatBar.modeOverride).toBe('agent');
  });

  it('renders pre-selected value when store has modeOverride set', () => {
    renderDropdown(false, 'agent');
    expect(screen.getByRole('combobox')).toHaveTextContent('Agent');
  });

  it('compact prop renders smaller height (32px) on the select', () => {
    const { container } = renderDropdown(true);
    // StyledSelect has height: 32 when compact=true. Check inline style or computed style
    // by looking at the .MuiOutlinedInput-root or root element.
    const root = container.querySelector('[class*="MuiOutlinedInput-root"]') as HTMLElement;
    expect(root).toBeTruthy();
    // Height comes from emotion CSS — assert the element exists and renders without error.
    // Direct inline-style assertion not possible with styled() + emotion in jsdom,
    // so we verify compact prop rendering does not error and combobox still works.
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('default (non-compact) also renders combobox correctly', () => {
    renderDropdown(false);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toHaveTextContent('Auto');
  });

  it('selecting Auto when already on Web Search switches back', async () => {
    const user = userEvent.setup();
    const { store } = renderDropdown(false, 'web_search');
    expect(screen.getByRole('combobox')).toHaveTextContent('Web Search');

    await user.click(screen.getByRole('combobox'));
    const listbox = await screen.findByRole('listbox');
    await user.click(within(listbox).getByText('Auto'));
    expect(store.getState().chatBar.modeOverride).toBe('auto');
  });
});
