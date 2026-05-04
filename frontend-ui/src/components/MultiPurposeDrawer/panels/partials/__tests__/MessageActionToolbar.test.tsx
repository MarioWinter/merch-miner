/**
 * PROJ-20 Phase 5 — MessageActionToolbar tests.
 *
 * Covers AC-30 (4 buttons), AC-31 (hidden during own-message stream),
 * AC-32 (Regenerate disabled while any stream is active), AC-34 (Copy uses
 * navigator.clipboard.writeText), EC-9 (Save-Answer idempotency).
 *
 * The searchSlice is mocked so we don't need to bootstrap RTK Query + axios
 * just to assert the toolbar's UX behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../../public/locales/en/translation.json';
import theme from '@/style/theme';

const { mockCreateShareLink } = vi.hoisted(() => ({
  mockCreateShareLink: vi.fn(),
}));

vi.mock('@/store/searchSlice', () => ({
  useCreateShareLinkMutation: () => [
    mockCreateShareLink,
    { isLoading: false },
  ],
}));

// Imported AFTER vi.mock so the component picks up the mocked hook.
import MessageActionToolbar from '../MessageActionToolbar';

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
  isOwnMessageStreaming?: boolean;
  isAnyStreamActive?: boolean;
  canRegenerate?: boolean;
  onRegenerate?: () => void;
  onSaveAnswer?: () => void;
  content?: string;
}

const renderToolbar = (opts: RenderOpts = {}) => {
  const onRegenerate = opts.onRegenerate ?? vi.fn();
  const onSaveAnswer = opts.onSaveAnswer ?? vi.fn();
  const result = render(
    <CssVarsProvider theme={theme} defaultMode="dark">
      <SnackbarProvider maxSnack={4}>
        <MessageActionToolbar
          messageId="msg-1"
          content={opts.content ?? '## Hello\n\nWorld'}
          sessionId="sess-1"
          isOwnMessageStreaming={opts.isOwnMessageStreaming ?? false}
          isAnyStreamActive={opts.isAnyStreamActive ?? false}
          canRegenerate={opts.canRegenerate ?? true}
          onRegenerate={onRegenerate}
          onSaveAnswer={onSaveAnswer}
        />
      </SnackbarProvider>
    </CssVarsProvider>,
  );
  return { ...result, onRegenerate, onSaveAnswer };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateShareLink.mockReset();
});

describe('MessageActionToolbar', () => {
  it('renders 4 IconButtons (Copy / Regen / Share / Save) (AC-30)', () => {
    renderToolbar();
    expect(screen.getByRole('button', { name: /copy message/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate response/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^share$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save answer to niche/i })).toBeInTheDocument();
  });

  it('renders nothing while own-message is streaming (AC-31)', () => {
    const { container } = renderToolbar({ isOwnMessageStreaming: true });
    expect(container.firstChild).toBeNull();
  });

  it('disables Regenerate while ANY stream is active (AC-32)', () => {
    renderToolbar({ isAnyStreamActive: true });
    expect(screen.getByRole('button', { name: /regenerate response/i })).toBeDisabled();
  });

  it('disables Regenerate when no prior user message (canRegenerate=false)', () => {
    renderToolbar({ canRegenerate: false });
    expect(screen.getByRole('button', { name: /regenerate response/i })).toBeDisabled();
  });

  it('Copy writes the markdown source to navigator.clipboard (AC-34)', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    renderToolbar({ content: '## Hello\n\nWorld' });
    fireEvent.click(screen.getByRole('button', { name: /copy message/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('## Hello\n\nWorld');
    });
  });

  it('Save fires onSaveAnswer once even on rapid double-click (EC-9)', () => {
    const onSaveAnswer = vi.fn();
    renderToolbar({ onSaveAnswer });
    const btn = screen.getByRole('button', { name: /save answer to niche/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onSaveAnswer).toHaveBeenCalledTimes(1);
  });

  it('Regenerate calls onRegenerate when enabled', () => {
    const onRegenerate = vi.fn();
    renderToolbar({ onRegenerate });
    fireEvent.click(
      screen.getByRole('button', { name: /regenerate response/i }),
    );
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('Share calls createShareLink + clipboard.writeText with public_url', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    mockCreateShareLink.mockReturnValue({
      unwrap: vi
        .fn()
        .mockResolvedValue({ public_url: 'https://example.test/shared/chat/abc' }),
    });
    renderToolbar();
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => {
      expect(mockCreateShareLink).toHaveBeenCalledWith('sess-1');
    });
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        'https://example.test/shared/chat/abc',
      );
    });
  });
});
