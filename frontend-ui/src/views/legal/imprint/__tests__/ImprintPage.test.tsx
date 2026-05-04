import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { renderWithProviders } from '../../../../utils/test-utils';
import ImprintPage from '../ImprintPage';
import deTranslation from '../../../../../public/locales/de/translation.json';

// Bundle DE resources so we can switch locale within tests
beforeAll(() => {
  if (!i18n.hasResourceBundle('de', 'translation')) {
    i18n.addResourceBundle('de', 'translation', deTranslation, true, true);
  }
});

afterEach(async () => {
  // Reset locale to EN so tests don't bleed
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ImprintPage (PROJ-24 AC-1/AC-7a/AC-7b)', () => {
  it('renders all 6 expected sections in DE locale', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<ImprintPage />);

    // Each section heading is an h2 (variant="h6", component="h2")
    expect(screen.getByRole('heading', { level: 2, name: /angaben gemäß § 5 tmg/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^kontakt$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /verfügbare sprachen/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /umsatzsteuer-identifikationsnummer/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /kontaktstelle gemäß art\. 12 dsa/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /haftungsausschluss/i })).toBeInTheDocument();
  });

  it('renders operator data: Mario Winter, Außenliegend 4, Echzell, phone, email, VAT', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<ImprintPage />);

    // Operator block (uses pre-line whitespace, single block with newlines)
    expect(screen.getAllByText(/Mario Winter/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Außenliegend 4/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/61209 Echzell/).length).toBeGreaterThan(0);

    // Phone link
    const phoneLink = screen.getByRole('link', { name: /\+49 1601546188/ });
    expect(phoneLink).toHaveAttribute('href', 'tel:+491601546188');

    // Email link (Imprint contact section)
    const emailLink = screen.getByRole('link', { name: /mariowinter\.sg@gmail\.com/ });
    expect(emailLink).toHaveAttribute('href', 'mailto:mariowinter.sg@gmail.com');

    // VAT ID
    expect(screen.getByText(/DE327848620/)).toBeInTheDocument();
  });

  it('hides the translation disclaimer banner when locale = de', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<ImprintPage />);

    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('shows the translation disclaimer banner when locale = en', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
      await flush();
    });
    renderWithProviders(<ImprintPage />);

    const banner = screen.getByRole('note');
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(/german version/i)).toBeInTheDocument();
  });

  it('sets document.title to "Impressum — Merch Miner" on mount', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<ImprintPage />);

    expect(document.title).toBe('Impressum — Merch Miner');
  });
});
