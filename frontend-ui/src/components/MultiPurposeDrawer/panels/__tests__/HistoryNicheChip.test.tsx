/**
 * FIX-chat-bugfixes-and-grouping Item 4 — focused tests for the read-only
 * niche chip rendered above user bubbles in chat history.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CssVarsProvider } from '@mui/material/styles';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from '../../../../../public/locales/en/translation.json';
import theme from '@/style/theme';
import HistoryNicheChip from '../HistoryNicheChip';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

const renderChip = (name: string, nicheId?: string | null) =>
  render(
    <CssVarsProvider theme={theme} defaultMode="dark">
      <HistoryNicheChip name={name} nicheId={nicheId} />
    </CssVarsProvider>,
  );

describe('HistoryNicheChip', () => {
  it('renders the name prefixed with @', () => {
    renderChip('Cats');
    const chip = screen.getByTestId('referenced-niche-chip');
    expect(chip.textContent).toBe('@Cats');
  });

  it('uses the i18n aria-label that interpolates the niche name', () => {
    renderChip('Cats');
    const chip = screen.getByTestId('referenced-niche-chip');
    expect(chip.getAttribute('aria-label')).toBe('Referenced niche: Cats');
  });

  it('exposes the niche id via data-niche-id when provided', () => {
    renderChip('Cats', 'niche-uuid-1');
    const chip = screen.getByTestId('referenced-niche-chip');
    expect(chip.getAttribute('data-niche-id')).toBe('niche-uuid-1');
  });

  it('omits data-niche-id when nicheId is null or undefined', () => {
    renderChip('Cats', null);
    const chip = screen.getByTestId('referenced-niche-chip');
    expect(chip.getAttribute('data-niche-id')).toBeNull();
  });

  it('renders no remove button (read-only)', () => {
    renderChip('Cats');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
