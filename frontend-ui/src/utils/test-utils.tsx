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
    ...renderOptions
  }: RenderWithProvidersOptions = {}
) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      workspace: workspaceReducer,
      ...reducers,
    },
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
