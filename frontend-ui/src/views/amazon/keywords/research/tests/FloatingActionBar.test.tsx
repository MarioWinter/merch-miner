import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import { FloatingActionBar } from '../partials/FloatingActionBar';

// Mock the RTK Query hooks used by AddToNicheButton
vi.mock('@/store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/nicheSlice')>();
  return {
    ...actual,
    useListNichesQuery: () => ({ data: { results: [] } }),
  };
});

vi.mock('@/store/keywordSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/keywordSlice')>();
  return {
    ...actual,
    useBulkAddKeywordsMutation: () => [vi.fn(), { isLoading: false }],
  };
});

describe('FloatingActionBar', () => {
  it('renders nothing when selectedCount is 0', () => {
    const { container } = renderWithProviders(
      <FloatingActionBar
        selectedCount={0}
        selectedKeywords={[]}
        onClearSelection={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when keywords are selected', () => {
    renderWithProviders(
      <FloatingActionBar
        selectedCount={3}
        selectedKeywords={['a', 'b', 'c']}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('shows disabled Enrich button', () => {
    renderWithProviders(
      <FloatingActionBar
        selectedCount={2}
        selectedKeywords={['a', 'b']}
        onClearSelection={vi.fn()}
      />,
    );
    const enrichBtn = screen.getByText('Enrich').closest('button');
    expect(enrichBtn).toBeDisabled();
  });

  it('shows Add to Niche button', () => {
    renderWithProviders(
      <FloatingActionBar
        selectedCount={2}
        selectedKeywords={['a', 'b']}
        onClearSelection={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add 2 to niche/)).toBeInTheDocument();
  });
});
