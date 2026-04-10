import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }), useGetNicheQuery: () => ({ data: null, isFetching: false }) }));
vi.mock('@/views/niches/list/partials/NichePipeline', () => ({ NichePipeline: () => null }));
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
import { IdeaListView } from '../IdeaListView';
import { makeIdea, makeOrphanIdea, makeAdaptedIdea } from './fixtures';
import type { IdeaListResponse } from '../types';

// ----- Mock RTK Query hooks -----
const mockListAllIdeas = vi.fn<() => {
  data: IdeaListResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
}>();

vi.mock('@/store/ideaSlice', () => ({
  ideaApi: fa('ideaApi'),
  useListAllIdeasQuery: (...args: unknown[]) => mockListAllIdeas(...(args as [])),
  useImportIdeasMutation: () => [vi.fn(), { isLoading: false }],
}));

// ----- Mock hooks -----
vi.mock('../hooks/useIdeaFilters', () => ({
  useIdeaFilters: () => ({
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
  }),
}));

vi.mock('../hooks/useInlineAdd', () => ({
  useIdeaInlineAdd: () => ({
    isActive: false,
    isCreating: false,
    error: null,
    activate: vi.fn(),
    cancel: vi.fn(),
    submit: vi.fn(),
  }),
}));

vi.mock('../hooks/useInlineEdit', () => ({
  useIdeaInlineEdit: () => ({
    activeCell: null,
    isSaving: false,
    activateCell: vi.fn(),
    deactivateCell: vi.fn(),
    saveSloganText: vi.fn(),
    saveNiche: vi.fn(),
  }),
}));

vi.mock('../hooks/useAdaptation', () => ({
  useAdaptation: () => ({
    triggerAdaptation: vi.fn(),
    run: undefined,
    isTriggering: false,
    isPolling: false,
    error: null,
    reset: vi.fn(),
  }),
}));

vi.mock('../hooks/useIdeaActions', () => ({
  useIdeaActions: () => ({
    approve: vi.fn(),
    reject: vi.fn(),
    setStatus: vi.fn(),
    deleteIdea: vi.fn(),
    improve: vi.fn(),
    regenerate: vi.fn(),
    bulkUpdateStatus: vi.fn(),
    isUpdating: false,
    isDeleting: false,
    isImproving: false,
    isRegenerating: false,
    isBulkUpdating: false,
  }),
}));

// Mock subcomponents that have deep RTK dependencies
vi.mock('../partials/IdeaFilterTemplateDropdown', () => ({
  IdeaFilterTemplateDropdown: () => <div data-testid="filter-template-dropdown" />,
}));

vi.mock('../hooks/useNicheSuggestions', () => ({
  useNicheSuggestions: () => ({
    suggestions: [],
    isLoading: false,
    error: false,
    autoSelectTop5: () => [],
    availableNiches: [],
  }),
}));

vi.mock('../partials/NicheSuggestionList', () => ({
  NicheSuggestionList: () => <div data-testid="niche-suggestion-list" />,
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('IdeaListView', () => {
  it('renders page title', () => {
    mockListAllIdeas.mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByText('Slogan Factory')).toBeInTheDocument();
  });

  it('renders import button', () => {
    mockListAllIdeas.mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByLabelText('Import')).toBeInTheDocument();
  });

  it('shows loading skeletons while loading', () => {
    mockListAllIdeas.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      isFetching: true,
    });
    renderWithProviders(<IdeaListView />);
    // 4 skeleton elements
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBe(4);
  });

  it('shows error state', () => {
    mockListAllIdeas.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows empty state when no ideas', () => {
    mockListAllIdeas.mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByText('No ideas yet')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Create your first idea or run research to discover slogans.',
      ),
    ).toBeInTheDocument();
  });

  it('renders idea cards when data exists', () => {
    const idea1 = makeIdea({ id: '1', slogan_text: 'Slogan A' });
    const idea2 = makeIdea({ id: '2', slogan_text: 'Slogan B' });
    mockListAllIdeas.mockReturnValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [idea1, idea2],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByText('Slogan A')).toBeInTheDocument();
    expect(screen.getByText('Slogan B')).toBeInTheDocument();
  });

  it('renders niche-less ideas', () => {
    const orphan = makeOrphanIdea({ slogan_text: 'Orphan idea text' });
    mockListAllIdeas.mockReturnValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        results: [orphan],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByText('Orphan idea text')).toBeInTheDocument();
  });

  it('renders source groups for ideas with adaptations', () => {
    const source = makeIdea({ id: 'src-1', slogan_text: 'Source text' });
    const adapted = makeAdaptedIdea('src-1', {
      id: 'adp-1',
      slogan_text: 'Adapted text',
    });
    mockListAllIdeas.mockReturnValue({
      data: {
        count: 2,
        next: null,
        previous: null,
        results: [source, adapted],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    // Source text appears in header + IdeaCard
    const matches = screen.getAllByText('Source text');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders inline add bar', () => {
    mockListAllIdeas.mockReturnValue({
      data: { count: 0, next: null, previous: null, results: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByText('Add new slogan...')).toBeInTheDocument();
  });

  it('renders pagination when page count > 1', () => {
    const ideas = Array.from({ length: 5 }, (_, i) =>
      makeIdea({ id: `idea-${i}`, slogan_text: `Slogan ${i}` }),
    );
    mockListAllIdeas.mockReturnValue({
      data: {
        count: 25, // More than PAGE_SIZE (20)
        next: 'next',
        previous: null,
        results: ideas,
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(screen.getByLabelText('Idea list pagination')).toBeInTheDocument();
  });

  it('does not render pagination for single page', () => {
    mockListAllIdeas.mockReturnValue({
      data: {
        count: 3,
        next: null,
        previous: null,
        results: [makeIdea()],
      },
      isLoading: false,
      isError: false,
      isFetching: false,
    });
    renderWithProviders(<IdeaListView />);
    expect(
      screen.queryByLabelText('Idea list pagination'),
    ).not.toBeInTheDocument();
  });
});
