import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [{ id: 'n1', name: 'Funny Dogs' }, { id: 'n2', name: 'Cat Lovers' }] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({ designApi: fa('designApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

import { renderWithProviders } from '../../../utils/test-utils';
import { IdeaFilterToolbar } from '../partials/IdeaFilterToolbar';
import type { UseIdeaFiltersReturn } from '../hooks/useIdeaFilters';

// Mock FilterTemplateDropdown — it uses RTK Query internally
vi.mock('../partials/IdeaFilterTemplateDropdown', () => ({
  IdeaFilterTemplateDropdown: () => (
    <div data-testid="filter-template-dropdown" />
  ),
}));

const makeFilterState = (
  overrides?: Partial<UseIdeaFiltersReturn>,
): UseIdeaFiltersReturn => ({
  filters: {
    niche_id: '',
    status: '',
    signal_type: '',
    ordering: '-created_at',
    page: 1,
  },
  setNicheId: vi.fn(),
  setStatus: vi.fn(),
  setSignalType: vi.fn(),
  setOrdering: vi.fn(),
  setPage: vi.fn(),
  resetFilters: vi.fn(),
  applyFilters: vi.fn(),
  activeFilterCount: 0,
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('IdeaFilterToolbar', () => {
  it('renders niche autocomplete', () => {
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState()} />,
    );
    expect(screen.getByRole('search', { name: 'All Niches' })).toBeInTheDocument();
  });

  it('renders status select', () => {
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState()} />,
    );
    expect(screen.getByLabelText('All Statuses')).toBeInTheDocument();
  });

  it('renders signal type select', () => {
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState()} />,
    );
    expect(screen.getByLabelText('All Signals')).toBeInTheDocument();
  });

  it('renders ordering select', () => {
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState()} />,
    );
    expect(screen.getByLabelText('Newest first')).toBeInTheDocument();
  });

  it('renders filter template dropdown', () => {
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState()} />,
    );
    expect(screen.getByTestId('filter-template-dropdown')).toBeInTheDocument();
  });

  it('does not show active filter badge when no filters', () => {
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState({ activeFilterCount: 0 })} />,
    );
    expect(
      screen.queryByLabelText(/active filters/i),
    ).not.toBeInTheDocument();
  });

  it('shows active filter badge when filters are set', () => {
    renderWithProviders(
      <IdeaFilterToolbar
        filterState={makeFilterState({ activeFilterCount: 2 })}
      />,
    );
    expect(screen.getByLabelText('2 active filters')).toBeInTheDocument();
  });

  it('shows clear filters button when filters active', () => {
    renderWithProviders(
      <IdeaFilterToolbar
        filterState={makeFilterState({ activeFilterCount: 1 })}
      />,
    );
    expect(screen.getByText('Clear filters')).toBeInTheDocument();
  });

  it('does not show clear filters when no active filters', () => {
    renderWithProviders(
      <IdeaFilterToolbar
        filterState={makeFilterState({ activeFilterCount: 0 })}
      />,
    );
    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
  });

  it('calls resetFilters when clear button clicked', () => {
    const resetFilters = vi.fn();
    renderWithProviders(
      <IdeaFilterToolbar
        filterState={makeFilterState({ activeFilterCount: 1, resetFilters })}
      />,
    );
    fireEvent.click(screen.getByText('Clear filters'));
    expect(resetFilters).toHaveBeenCalledOnce();
  });

  it('calls setStatus when status select changes', () => {
    const setStatus = vi.fn();
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState({ setStatus })} />,
    );
    // Open status select (index 0 = status, 1 = signal, 2 = ordering)
    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    fireEvent.mouseDown(selectDivs[0]);

    const option = screen.getByRole('option', { name: 'Approved' });
    fireEvent.click(option);

    expect(setStatus).toHaveBeenCalledWith('approved');
  });

  it('calls setSignalType when signal select changes', () => {
    const setSignalType = vi.fn();
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState({ setSignalType })} />,
    );
    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    fireEvent.mouseDown(selectDivs[1]);

    const option = screen.getByRole('option', { name: 'SELF' });
    fireEvent.click(option);

    expect(setSignalType).toHaveBeenCalledWith('self');
  });

  it('calls setOrdering when ordering select changes', () => {
    const setOrdering = vi.fn();
    renderWithProviders(
      <IdeaFilterToolbar filterState={makeFilterState({ setOrdering })} />,
    );
    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    fireEvent.mouseDown(selectDivs[2]);

    const option = screen.getByRole('option', { name: 'Oldest first' });
    fireEvent.click(option);

    expect(setOrdering).toHaveBeenCalledWith('created_at');
  });
});
