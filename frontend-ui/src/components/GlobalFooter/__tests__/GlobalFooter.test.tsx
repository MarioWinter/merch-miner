import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import GlobalFooter from '../GlobalFooter';

describe('GlobalFooter (PROJ-24 AC-8/AC-9/AC-12)', () => {
  it('renders three zones — empty left, legal nav center, copyright right', () => {
    renderWithProviders(<GlobalFooter />);

    // contentinfo landmark = footer wrapper
    const footer = screen.getByRole('contentinfo');
    expect(footer).toBeInTheDocument();

    // Center zone is a <nav> with aria-label "Legal"
    const nav = within(footer).getByRole('navigation', { name: /legal/i });
    expect(nav).toBeInTheDocument();

    // Copyright text present in right zone
    expect(within(footer).getByText(/merch miner/i)).toBeInTheDocument();
  });

  it('renders Imprint link pointing to /legal/imprint', () => {
    renderWithProviders(<GlobalFooter />);

    const imprintLink = screen.getByRole('link', { name: /imprint/i });
    expect(imprintLink).toBeInTheDocument();
    expect(imprintLink).toHaveAttribute('href', '/legal/imprint');
  });

  it('renders Privacy link pointing to /legal/privacy', () => {
    renderWithProviders(<GlobalFooter />);

    const privacyLink = screen.getByRole('link', { name: /privacy/i });
    expect(privacyLink).toBeInTheDocument();
    expect(privacyLink).toHaveAttribute('href', '/legal/privacy');
  });

  it('renders copyright text containing "© 2026" and "Merch Miner"', () => {
    renderWithProviders(<GlobalFooter />);

    const copyright = screen.getByText(/©\s*2026.*merch miner/i);
    expect(copyright).toBeInTheDocument();
  });

  it('renders translated text from i18n keys (EN locale via test-utils)', () => {
    renderWithProviders(<GlobalFooter />);

    // Footer keys resolve from EN translation bundle loaded by renderWithProviders
    expect(screen.getByRole('link', { name: 'Imprint' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText('© 2026 - Merch Miner')).toBeInTheDocument();
  });
});
