import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';

import './i18n';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { InitColorSchemeScript } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { SnackbarProvider } from 'notistack';

import { store } from './store';
import theme from './style/theme';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme} defaultMode="dark" modeStorageKey="mm-color-mode">
        <InitColorSchemeScript defaultMode="dark" modeStorageKey="mm-color-mode" />
        <CssBaseline />
        <SnackbarProvider
          maxSnack={4}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          autoHideDuration={4000}
        >
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </Provider>
  </StrictMode>
);
