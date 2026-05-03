import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, screen, within } from '@testing-library/react';
import i18n from 'i18next';
import { renderWithProviders } from '../../../../utils/test-utils';
import PrivacyPage from '../PrivacyPage';
import deTranslation from '../../../../../public/locales/de/translation.json';
import frTranslation from '../../../../../public/locales/fr/translation.json';

// Bundle DE + FR resources so we can switch locale within tests
beforeAll(() => {
  if (!i18n.hasResourceBundle('de', 'translation')) {
    i18n.addResourceBundle('de', 'translation', deTranslation, true, true);
  }
  if (!i18n.hasResourceBundle('fr', 'translation')) {
    i18n.addResourceBundle('fr', 'translation', frTranslation, true, true);
  }
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PrivacyPage (PROJ-24 AC-2/AC-7a)', () => {
  it('renders all 12 expected sections (per AC-7a) in DE locale', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<PrivacyPage />);

    // h1 page title
    expect(screen.getByRole('heading', { level: 1, name: /datenschutzerklärung/i })).toBeInTheDocument();

    // 12 section headings (h2 via component="h2")
    expect(screen.getByRole('heading', { level: 2, name: /1\. datenschutz auf einen blick/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /hinweis zur verantwortlichen stelle/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /2\. hosting \(strato\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /datenbank & storage/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /authentifizierung \(jwt-cookie\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /llm-observability \(langfuse/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /llm-api \(openrouter\)/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /workflow-automation \(n8n/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /onedrive/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /google drive/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /ihre rechte als betroffene person/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /^kontakt$/i })).toBeInTheDocument();
  });

  it('excludes the Facebook section (AC-7a)', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<PrivacyPage />);

    expect(screen.queryByText(/facebook/i)).not.toBeInTheDocument();
  });

  it('renders phone link with href tel:+491601546188 and visible "+49 1601546188"', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<PrivacyPage />);

    const phoneLink = screen.getByRole('link', { name: /\+49 1601546188/ });
    expect(phoneLink).toHaveAttribute('href', 'tel:+491601546188');
  });

  it('renders mailto link to mariowinter.sg@gmail.com (responsible_party + contact sections)', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<PrivacyPage />);

    const emailLinks = screen.getAllByRole('link', { name: /mariowinter\.sg@gmail\.com/ });
    expect(emailLinks.length).toBeGreaterThanOrEqual(2);
    emailLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', 'mailto:mariowinter.sg@gmail.com');
    });
  });

  it('sets document.title to "Datenschutzerklärung — Merch Miner" on mount', async () => {
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    renderWithProviders(<PrivacyPage />);

    expect(document.title).toBe('Datenschutzerklärung — Merch Miner');
  });

  it('hides the translation disclaimer in DE; shows it when switched to FR', async () => {
    // DE — banner hidden
    await act(async () => {
      await i18n.changeLanguage('de');
      await flush();
    });
    const { unmount } = renderWithProviders(<PrivacyPage />);
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    unmount();

    // FR — banner visible
    await act(async () => {
      await i18n.changeLanguage('fr');
      await flush();
    });
    renderWithProviders(<PrivacyPage />);
    const banner = screen.getByRole('note');
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(/version allemande/i)).toBeInTheDocument();
  });
});
