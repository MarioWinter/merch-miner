import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';
import { NicheFilterToolbar } from '../partials/NicheFilterToolbar';
import type { UseNicheFiltersReturn } from '../hooks/useNicheFilters';

// FilterTemplateDropdown calls RTK Query — mock the entire component
vi.mock('../partials/FilterTemplateDropdown', () => ({
  FilterTemplateDropdown: () => <div data-testid="filter-template-dropdown" />,
}));

const makeFilterState = (overrides?: Partial<UseNicheFiltersReturn>): UseNicheFiltersReturn => ({
  filters: {
    search: '',
    status: '',
    status_group: '',
    potential_rating: '',
    assigned_to: '',
    ordering: '',
    page: 1,
  },
  setSearch: vi.fn(),
  setStatus: vi.fn(),
  setStatusGroup: vi.fn(),
  setPotentialRating: vi.fn(),
  setAssignedTo: vi.fn(),
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

describe('NicheFilterToolbar', () => {
  it('renders search input', () => {
    const filterState = makeFilterState();
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    expect(screen.getByPlaceholderText(/search niches/i)).toBeInTheDocument();
  });

  it('calls setSearch when typing in search input', () => {
    const setSearch = vi.fn();
    const filterState = makeFilterState({ setSearch });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);

    const input = screen.getByPlaceholderText(/search niches/i);
    fireEvent.change(input, { target: { value: 'shoes' } });

    expect(setSearch).toHaveBeenCalledWith('shoes');
  });

  it('does not show active filter badge when no filters active', () => {
    const filterState = makeFilterState({ activeFilterCount: 0 });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    expect(screen.queryByLabelText(/filter active/i)).not.toBeInTheDocument();
  });

  it('shows active filter badge when filters are set', () => {
    const filterState = makeFilterState({ activeFilterCount: 2 });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    expect(screen.getByLabelText(/2 filters active/i)).toBeInTheDocument();
  });

  it('shows "Clear filters" button when activeFilterCount > 0', () => {
    const filterState = makeFilterState({ activeFilterCount: 1 });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    expect(screen.getByText(/clear filters/i)).toBeInTheDocument();
  });

  it('does not show "Clear filters" button when no filters active', () => {
    const filterState = makeFilterState({ activeFilterCount: 0 });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    expect(screen.queryByText(/clear filters/i)).not.toBeInTheDocument();
  });

  it('calls resetFilters when Clear filters button is clicked', () => {
    const resetFilters = vi.fn();
    const filterState = makeFilterState({ activeFilterCount: 2, resetFilters });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);

    fireEvent.click(screen.getByText(/clear filters/i));
    expect(resetFilters).toHaveBeenCalledOnce();
  });

  it('calls setStatusGroup when status-group select changes', () => {
    const setStatusGroup = vi.fn();
    const filterState = makeFilterState({ setStatusGroup });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);

    // MUI Select renders a hidden native <select> — fire change on it directly
    // Simpler: trigger via the onChange handler by finding the Select's visible div
    // We use the MUI Select's data attribute approach — the div with role and aria
    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    // selectDivs[0]=status_group, [1]=status, [2]=potential_rating, [3]=assignee, [4]=ordering
    fireEvent.mouseDown(selectDivs[0]);

    const option = screen.getByRole('option', { name: /^to-do$/i });
    fireEvent.click(option);

    expect(setStatusGroup).toHaveBeenCalledWith('todo');
  });

  it('calls setPotentialRating when rating select changes', () => {
    const setPotentialRating = vi.fn();
    const filterState = makeFilterState({ setPotentialRating });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);

    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    // [2] = potential_rating
    fireEvent.mouseDown(selectDivs[2]);

    const option = screen.getByRole('option', { name: /^rejected$/i });
    fireEvent.click(option);

    expect(setPotentialRating).toHaveBeenCalledWith('rejected');
  });

  it('renders ordering select element', () => {
    const filterState = makeFilterState();
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    // status_group + status + potential_rating + assignee + ordering = 5 selects
    expect(selectDivs.length).toBe(5);
  });

  it('calls setOrdering when ordering select changes', () => {
    const setOrdering = vi.fn();
    const filterState = makeFilterState({ setOrdering });
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);

    const selectDivs = document.querySelectorAll('.MuiSelect-select');
    // [4] = ordering
    fireEvent.mouseDown(selectDivs[4]);

    const option = screen.getByRole('option', { name: /newest first/i });
    fireEvent.click(option);

    expect(setOrdering).toHaveBeenCalledWith('-created_at');
  });

  it('renders filter template dropdown', () => {
    const filterState = makeFilterState();
    renderWithProviders(<NicheFilterToolbar filterState={filterState} />);
    expect(screen.getByTestId('filter-template-dropdown')).toBeInTheDocument();
  });
});
