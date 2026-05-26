// PROJ-34 Phase 13t-i — NichePresetsAccordion shell tests.
// Confirms default-expanded behavior (AC-80), tab interactivity (AC-81),
// and count-badge rendering with stubbed RTK Query hooks.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { presetCardsApi } from '@/services/presetCardsApi';
import NichePresetsAccordion from '../NichePresetsAccordion';

vi.mock('@/services/presetCardsApi', async () => {
  const actual =
    await vi.importActual<typeof import('@/services/presetCardsApi')>(
      '@/services/presetCardsApi',
    );
  return {
    ...actual,
    useGetVorschlaegeQuery: () => ({ data: undefined, isLoading: false, error: undefined }),
    useGetHistoryQuery: () => ({ data: undefined, isLoading: false, error: undefined }),
    useGetCustomQuery: () => ({ data: undefined, isLoading: false, error: undefined }),
  };
});

const renderShell = (nicheId: string | null = 'niche-abc') =>
  renderWithProviders(<NichePresetsAccordion nicheId={nicheId} />, {
    reducers: { [presetCardsApi.reducerPath]: presetCardsApi.reducer },
  });

describe('NichePresetsAccordion (PROJ-34 Phase 13t-i)', () => {
  it('renders the section title and is expanded by default', () => {
    renderShell();
    expect(screen.getByText(/From the Niche/i)).toBeInTheDocument();
    // Default-expanded → tablist is mounted and visible.
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders all three tabs in fixed order', () => {
    renderShell();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveTextContent(/Suggestions/i);
    expect(tabs[1]).toHaveTextContent(/History/i);
    expect(tabs[2]).toHaveTextContent(/Custom/i);
  });

  it('switches active tab on click', () => {
    renderShell();
    const historyTab = screen.getByRole('tab', { name: /History/i });
    fireEvent.click(historyTab);
    expect(historyTab).toHaveAttribute('aria-selected', 'true');
  });

  it('renders count badges in the documented format', () => {
    renderShell();
    // Phase 13t-s removed the /13 hard-coded denominator (Collection cards can
    // push the total above 13). Vorschläge badge is now just the count; only
    // the History badge keeps the /50 LRU-cap denominator.
    expect(screen.getByText(/0\/50/)).toBeInTheDocument();
  });

  it('shows the no-niche placeholder when nicheId is null', () => {
    renderShell(null);
    expect(
      screen.getByText(/Pick a niche on the project to see suggestions/i),
    ).toBeInTheDocument();
  });
});
