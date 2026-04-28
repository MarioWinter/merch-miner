/**
 * PROJ-20 Phase 7.7 — UserAttachments tests.
 *
 * Verifies thumbnail tiles render with hrefs to the full-res file, and the
 * purged placeholder appears when `purged_at` is set or `thumbnail_url` is null.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CssVarsProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from '../../../../../../public/locales/en/translation.json';
import theme from '@/style/theme';
import type { ChatAttachment } from '@/types/search';
import UserAttachments from '../UserAttachments';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const wrap = (ui: React.ReactElement) =>
  render(
    <CssVarsProvider theme={theme} defaultMode="dark">{ui}</CssVarsProvider>,
  );

const make = (overrides: Partial<ChatAttachment> = {}): ChatAttachment => ({
  id: 'a1',
  filename: 'photo.png',
  mime_type: 'image/webp',
  size: 1024,
  thumbnail_url: '/media/chat-attachments/ws/a1.webp',
  attachment_type: 'image',
  status: 'completed',
  created_at: '2026-04-28T00:00:00Z',
  purged_at: null,
  ...overrides,
});

describe('UserAttachments', () => {
  it('renders nothing when the array is empty', () => {
    const { container } = wrap(<UserAttachments attachments={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a clickable tile per attachment with target=_blank', () => {
    wrap(
      <UserAttachments
        attachments={[
          make({ id: 'a1', filename: 'one.png', thumbnail_url: '/m/one.webp' }),
          make({ id: 'a2', filename: 'two.png', thumbnail_url: '/m/two.webp' }),
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('/m/one.webp');
    expect(links[0].getAttribute('target')).toBe('_blank');
    // Image alt is the original filename
    expect(screen.getByAltText('one.png')).toBeInTheDocument();
    expect(screen.getByAltText('two.png')).toBeInTheDocument();
  });

  it('shows the purged placeholder when purged_at is set', () => {
    wrap(
      <UserAttachments
        attachments={[
          make({
            id: 'a1',
            filename: 'gone.png',
            thumbnail_url: null,
            purged_at: '2026-08-01T00:00:00Z',
            status: 'purged',
          }),
        ]}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('[Image purged]')).toBeInTheDocument();
  });

  it('treats a missing thumbnail_url as purged even when purged_at is null', () => {
    wrap(
      <UserAttachments
        attachments={[
          make({ thumbnail_url: null, purged_at: null }),
        ]}
      />,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('[Image purged]')).toBeInTheDocument();
  });
});
