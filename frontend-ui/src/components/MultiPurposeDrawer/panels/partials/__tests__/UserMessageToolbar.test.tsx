/**
 * PROJ-29 Phase 1J follow-up — UserMessageToolbar tests.
 *
 * Covers:
 *   - Copy button always rendered + writes content to clipboard.
 *   - Retry button rendered only when `onRetry` is supplied (parent gates
 *     visibility based on the next-message error pairing).
 *   - Retry click invokes the parent handler.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../../public/locales/en/translation.json';
import theme from '@/style/theme';

import UserMessageToolbar from '../UserMessageToolbar';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

interface RenderOpts {
  content?: string;
  onRetry?: () => void;
}

const renderToolbar = (opts: RenderOpts = {}) => {
  const result = render(
    <CssVarsProvider theme={theme} defaultMode="dark">
      <SnackbarProvider maxSnack={4}>
        <UserMessageToolbar
          content={opts.content ?? 'hello world'}
          onRetry={opts.onRetry}
        />
      </SnackbarProvider>
    </CssVarsProvider>,
  );
  return result;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('UserMessageToolbar', () => {
  it('renders the Copy button by default', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('does NOT render the Retry button when onRetry is undefined', () => {
    renderToolbar();
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();
  });

  it('renders the Retry button when onRetry is supplied', () => {
    renderToolbar({ onRetry: vi.fn() });
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it('Copy click writes the content to navigator.clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    renderToolbar({ content: 'my user question' });
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('my user question');
    });
  });

  it('Retry click invokes the handler', () => {
    const onRetry = vi.fn();
    renderToolbar({ onRetry });
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
