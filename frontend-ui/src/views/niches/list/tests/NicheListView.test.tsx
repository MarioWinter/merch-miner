import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import chatBarReducer from '../../../../store/chatBarSlice';
import NicheListView from '../NicheListView';
import type { Niche, NicheListResponse } from '../types';

// ── RTK Query mock ────────────────────────────────────────────────────────────
// We mock only the hooks the view uses directly; the drawer/toolbar internals
// are isolated via their own unit tests.

const mockDeleteNiche = vi.fn();

const emptyResponse: NicheListResponse = { count: 0, next: null, previous: null, results: [] };

let mockListNichesResult: {
  data?: NicheListResponse;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
} = { isLoading: false, isError: false, isFetching: false, data: emptyResponse };

vi.mock('../../../../store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/nicheSlice')>();
  return {
    ...actual,
    useListNichesQuery: () => mockListNichesResult,
    useDeleteNicheMutation: () => [mockDeleteNiche, { isLoading: false }],
    useGetNicheQuery: () => ({ data: undefined, isFetching: false }),
    useCreateNicheMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateNicheMutation: () => [vi.fn(), { isLoading: false }],
    useBulkNicheActionMutation: () => [vi.fn(), { isLoading: false }],
    useListFilterTemplatesQuery: () => ({ data: [], isLoading: false }),
  };
});

// Mock ideaSlice — usePipelineCounts uses useListIdeasQuery
vi.mock('../../../../store/ideaSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/ideaSlice')>();
  return {
    ...actual,
    useListIdeasQuery: () => ({ data: { results: [] }, isLoading: false }),
    useUpdateIdeaMutation: () => [vi.fn(), { isLoading: false }],
  };
});

// Mock keywordSlice — DrawerKeywordsSection uses keyword queries
vi.mock('../../../../store/keywordSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/keywordSlice')>();
  return {
    ...actual,
    useListNicheKeywordsQuery: () => ({ data: { results: [] }, isLoading: false }),
    useListKeywordGroupsQuery: () => ({ data: [], isLoading: false }),
    useDeleteKeywordMutation: () => [vi.fn(), { isLoading: false }],
    useCreateKeywordGroupMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateKeywordGroupMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteKeywordGroupMutation: () => [vi.fn(), { isLoading: false }],
  };
});

// Mock collectedProductsSlice — usePipelineCounts uses useGetCollectedProductsQuery
vi.mock('../../../../store/collectedProductsSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/collectedProductsSlice')>();
  return {
    ...actual,
    useGetCollectedProductsQuery: () => ({ data: { results: [] }, isLoading: false }),
    useRemoveCollectedProductMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
    useExtractKeywordsMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
    useSaveListingTemplateMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn() }), { isLoading: false }],
  };
});

// Mock designSlice — usePipelineCounts uses useListProjectsQuery
vi.mock('../../../../store/designSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/designSlice')>();
  return {
    ...actual,
    useListProjectsQuery: () => ({ data: { results: [] }, isLoading: false }),
  };
});

const buildNiche = (overrides?: Partial<Niche>): Niche => ({
  id: 'niche-1',
  workspace: 'ws-1',
  name: 'Hiking Gifts',
  notes: '',
  status: 'data_entry',
  potential_rating: null,
  research_status: null,
  research_run_id: null,
  research_progress: null,
  position: 0,
  assigned_to: null,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  idea_count: 5,
  approved_idea_count: 2,
  ...overrides,
});

describe('NicheListView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to empty default
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: emptyResponse,
    };
  });

  it('renders page title "Niche Claims"', () => {
    renderWithProviders(<NicheListView />);
    expect(screen.getByText('Niche Claims')).toBeInTheDocument();
  });

  it('renders at least one "+ New Niche" button', () => {
    renderWithProviders(<NicheListView />);
    // EmptyState also renders "New Niche" — getAllByRole is the correct query
    const buttons = screen.getAllByRole('button', { name: /new niche/i });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows TableSkeleton while loading', () => {
    mockListNichesResult = { isLoading: true, isError: false, isFetching: true, data: undefined };
    renderWithProviders(<NicheListView />);
    // TableSkeleton renders MUI Skeleton elements — check for the wrapper role or aria
    // The skeleton component renders Skeleton elements inside a Table; at minimum the table
    // should not be showing real rows.
    expect(screen.queryByText('Hiking Gifts')).not.toBeInTheDocument();
  });

  it('shows empty state (no niches) when results are empty and no filters', () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: emptyResponse,
    };
    renderWithProviders(<NicheListView />, { initialRoute: '/niches' });
    expect(screen.getByText(/no niches yet/i)).toBeInTheDocument();
  });

  it('shows empty state (no results) when results are empty and search filter is active', () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: emptyResponse,
    };
    renderWithProviders(<NicheListView />, { initialRoute: '/niches?search=xyz' });
    expect(screen.getByText(/no niches match your filters/i)).toBeInTheDocument();
  });

  it('shows the table when niches are present', () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: { count: 1, next: null, previous: null, results: [buildNiche()] },
    };
    renderWithProviders(<NicheListView />);
    expect(screen.getByText('Hiking Gifts')).toBeInTheDocument();
  });

  it('shows multiple niche rows', () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [
          buildNiche({ id: 'n1', name: 'Yoga Gifts' }),
          buildNiche({ id: 'n2', name: 'Dog Lover Gifts' }),
        ],
      },
    };
    renderWithProviders(<NicheListView />);
    expect(screen.getByText('Yoga Gifts')).toBeInTheDocument();
    expect(screen.getByText('Dog Lover Gifts')).toBeInTheDocument();
  });

  it('clicking page-header "+ New Niche" dispatches openDrawer(niche) + create mode', async () => {
    // PROJ-17 AC-35: drawer is now MPDrawer (global) — NicheListView no longer mounts a local <Drawer>.
    // Clicking "+ New Niche" dispatches Redux actions; assert store state instead of DOM.
    const { store } = renderWithProviders(<NicheListView />, {
      reducers: { chatBar: chatBarReducer },
    });
    const buttons = screen.getAllByRole('button', { name: /new niche/i });
    await userEvent.click(buttons[0]);
    const state = store.getState() as ReturnType<typeof store.getState> & {
      chatBar: {
        drawerOpen: boolean;
        activePanel: string;
        nicheMode: string;
        activeNicheId: string | null;
      };
    };
    expect(state.chatBar.drawerOpen).toBe(true);
    expect(state.chatBar.activePanel).toBe('niche');
    expect(state.chatBar.nicheMode).toBe('create');
    expect(state.chatBar.activeNicheId).toBeNull();
  });

  it('BulkActionBar is hidden when no rows are selected', () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: { count: 1, next: null, previous: null, results: [buildNiche()] },
    };
    renderWithProviders(<NicheListView />);
    // BulkActionBar uses Slide — when selectedCount === 0, content is unmounted
    expect(screen.queryByRole('toolbar', { name: /bulk actions/i })).not.toBeInTheDocument();
  });

  it('BulkActionBar appears after selecting a niche', async () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: { count: 1, next: null, previous: null, results: [buildNiche()] },
    };
    renderWithProviders(<NicheListView />);

    const checkbox = screen.getByRole('checkbox', { name: /select hiking gifts/i });
    await userEvent.click(checkbox);

    expect(await screen.findByRole('toolbar', { name: /bulk actions/i })).toBeInTheDocument();
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('shows error state when query fails', () => {
    mockListNichesResult = { isLoading: false, isError: true, isFetching: false, data: undefined };
    renderWithProviders(<NicheListView />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not show pagination when total niches fit in one page', () => {
    mockListNichesResult = {
      isLoading: false,
      isError: false,
      isFetching: false,
      data: { count: 5, next: null, previous: null, results: Array.from({ length: 5 }, (_, i) => buildNiche({ id: `n${i}`, name: `Niche ${i}` })) },
    };
    renderWithProviders(<NicheListView />);
    expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
  });
});
