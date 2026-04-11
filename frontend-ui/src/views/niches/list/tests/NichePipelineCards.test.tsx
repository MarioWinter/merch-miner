import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';
import { NichePipeline } from '../partials/NichePipeline';
import collectedItemsReducer from '../../../../store/collectedItemsSlice';
import type { Niche } from '../types';

// ── Shared mock handlers ──────────────────────────────────────────────
const mockGetNiche = vi.fn();

vi.mock('../../../../store/ideaSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/ideaSlice')>();
  return {
    ...actual,
    useListIdeasQuery: () => ({ data: { results: [] }, isLoading: false }),
    useUpdateIdeaMutation: () => [vi.fn(), { isLoading: false }],
  };
});

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

vi.mock('../../../../store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/nicheSlice')>();
  return {
    ...actual,
    useCreateNicheMutation: () => [vi.fn(), { isLoading: false }],
    useUpdateNicheMutation: () => [vi.fn(), { isLoading: false }],
    useDeleteNicheMutation: () => [vi.fn(), { isLoading: false }],
    useGetNicheQuery: (_id: string, opts: { skip?: boolean }) => {
      if (opts?.skip) return { data: undefined, isFetching: false };
      return mockGetNiche();
    },
  };
});

vi.mock('../../../../store/designSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/designSlice')>();
  return {
    ...actual,
    useListProjectsQuery: () => ({ data: { results: [] } }),
    useAddReferencesToProjectMutation: () => [vi.fn(), { isLoading: false }],
  };
});

// Mock ProjectNamingDialog to avoid deep dependency tree
vi.mock('@/views/designs/board/partials/ProjectNamingDialog', () => ({
  ProjectNamingDialog: () => null,
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// ── Fixture ───────────────────────────────────────────────────────────
const mockNiche: Niche = {
  id: 'niche-abc',
  workspace: 'ws-1',
  name: 'Yoga Gifts',
  notes: 'Some notes',
  status: 'data_entry',
  potential_rating: null,
  research_status: null,
  research_run_id: null,
  research_progress: { status: 'completed', completed_nodes: ['a', 'b', 'c', 'd', 'e', 'f'], total_nodes: 6 },
  position: 0,
  assigned_to: null,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  idea_count: 4,
  approved_idea_count: 1,
};

// Expected pipeline card order for reference:
// Research → Keywords → Products → Slogans → Designs → Listings → Upload

describe('NichePipeline — pipeline cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNiche.mockReturnValue({ data: mockNiche, isFetching: false });
  });

  it('renders 7 PipelineCards in edit mode', async () => {
    renderWithProviders(
      <NichePipeline
        open={true}
        mode="edit"
        selectedId="niche-abc"
        onClose={vi.fn()}
      />,
      { reducers: { collectedItems: collectedItemsReducer } },
    );

    // Wait for niche data to load and form to render
    expect(await screen.findByDisplayValue('Yoga Gifts')).toBeInTheDocument();

    // Verify all 7 pipeline card titles are present
    // The titles come from i18n keys — in test env they resolve to the key itself
    // or the fallback text. Check for at least the known translated strings.
    const drawer = screen.getByRole('presentation');

    // Each PipelineCard header contains a title in a subtitle2 Typography
    // Look for the card titles rendered via t() — they use i18n keys
    // The test i18n resolves keys from the translation JSON
    const headings = within(drawer).getAllByText(
      /Research|Keywords|Collected Products|Slogans|Designs|Listings|Upload/i,
    );
    expect(headings.length).toBeGreaterThanOrEqual(7);
  });

  it('renders Research card with "Done" badge when research is completed', async () => {
    renderWithProviders(
      <NichePipeline
        open={true}
        mode="edit"
        selectedId="niche-abc"
        onClose={vi.fn()}
      />,
      { reducers: { collectedItems: collectedItemsReducer } },
    );

    await screen.findByDisplayValue('Yoga Gifts');

    // Research card should show "Done" badge since research_progress.status = 'completed'
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('does not render pipeline cards in create mode', () => {
    renderWithProviders(
      <NichePipeline
        open={true}
        mode="create"
        selectedId={null}
        onClose={vi.fn()}
      />,
      { reducers: { collectedItems: collectedItemsReducer } },
    );

    // In create mode, no niche exists yet — pipeline cards should not render
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  it('renders pipeline cards in correct DOM order', async () => {
    renderWithProviders(
      <NichePipeline
        open={true}
        mode="edit"
        selectedId="niche-abc"
        onClose={vi.fn()}
      />,
      { reducers: { collectedItems: collectedItemsReducer } },
    );

    await screen.findByDisplayValue('Yoga Gifts');

    // Verify pipeline card titles appear in correct DOM order
    const drawer = screen.getByRole('presentation');
    const allText = drawer.textContent ?? '';

    // These labels appear in order in the rendered DOM
    const expectedOrder = [
      'AI Research',
      'Keywords',
      'Collected Products',
      'Collected Slogans',
      'Listings',
      'Upload',
    ];

    let lastIdx = -1;
    for (const label of expectedOrder) {
      const idx = allText.indexOf(label);
      expect(idx, `"${label}" not found in DOM`).toBeGreaterThan(-1);
      expect(idx, `"${label}" should come after previous card`).toBeGreaterThan(lastIdx);
      lastIdx = idx;
    }
  });

  it('shows research progress badge when research is running', async () => {
    const runningNiche: Niche = {
      ...mockNiche,
      research_progress: {
        status: 'running',
        completed_nodes: ['scrape', 'vision'],
        total_nodes: 6,
      },
    };
    mockGetNiche.mockReturnValue({ data: runningNiche, isFetching: false });

    renderWithProviders(
      <NichePipeline
        open={true}
        mode="edit"
        selectedId="niche-abc"
        onClose={vi.fn()}
      />,
      { reducers: { collectedItems: collectedItemsReducer } },
    );

    await screen.findByDisplayValue('Yoga Gifts');

    // Active research shows fractional badge "2/6"
    expect(screen.getByText('2/6')).toBeInTheDocument();
  });
});
