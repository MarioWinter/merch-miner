import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore, type Reducer } from '@reduxjs/toolkit';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import authReducer from '../store/authSlice';
import workspaceReducer from '../store/workspaceSlice';
import upscaleReducer from '../store/upscaleSlice';
import { upscaleApi } from '../store/upscaleApi';
import { searchHistoryApi } from '../store/searchHistorySlice';
import theme from '../style/theme';

// Import translation resources directly so tests don't depend on HTTP fetch
import enTranslation from '../../public/locales/en/translation.json';

// Initialize i18n with bundled resources for the test environment.
// This avoids the HttpBackend fetch that fails in JSDOM.
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

type ReducerMap = Record<string, Reducer>;

interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  reducers?: ReducerMap;
  initialRoute?: string;
  /** Optional initial Redux state — keys must match the reducers map. */
  preloadedState?: Record<string, unknown>;
}

/**
 * Test utility that wraps the component under test with all required providers:
 * Redux store, MUI CssVarsProvider, SnackbarProvider, and MemoryRouter.
 */
export const renderWithProviders = (
  ui: ReactElement,
  {
    reducers,
    initialRoute = '/',
    preloadedState,
    ...renderOptions
  }: RenderWithProvidersOptions = {}
) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      workspace: workspaceReducer,
      // PROJ-27 — register by default so any component reading upscale state
      // (e.g. UpscaleStatusPill mounted in Topbar) doesn't crash in tests
      // that don't explicitly register it.
      upscale: upscaleReducer,
      [upscaleApi.reducerPath]: upscaleApi.reducer,
      // Default-register so every component using useUserSearchHistory
      // (Amazon Research, Keyword Drilling, …) renders in tests without
      // requiring per-test reducer wiring.
      [searchHistoryApi.reducerPath]: searchHistoryApi.reducer,
      ...reducers,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware()
        .concat(upscaleApi.middleware)
        .concat(searchHistoryApi.middleware),
    // Cast: configureStore wants a fully-typed PreloadedState shape, but
    // tests pass partial state for whatever slices they care about.
    preloadedState: preloadedState as never,
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4} autoHideDuration={4000}>
          <MemoryRouter initialEntries={[initialRoute]}>
            {children}
          </MemoryRouter>
        </SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
};
