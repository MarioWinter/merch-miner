import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ProjectReference } from '../../gallery/types';

// ── Fake RTK Query API factory (same pattern as DesignWorkspaceView.test) ──
/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: {
      resetApiState: () => ({ type: 'noop' }),
      invalidateTags: () => ({ type: 'noop' }),
    },
  }),
}));

vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

// Mock designSlice — include fake API + the hooks ReferencesSection uses
const mockRemoveReference = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve() });
const mockAnalyzeImage = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve() });

vi.mock('@/store/designSlice', () => ({
  designApi: fa('designApi'),
  useRemoveReferenceFromProjectMutation: () => [mockRemoveReference, { isLoading: false }],
  useAnalyzeProductImageMutation: () => [mockAnalyzeImage, { isLoading: false }],
}));

import { renderWithProviders } from '../../../../utils/test-utils';
import ReferencesSection from '../partials/rightPanel/ReferencesSection';

// ── Fixtures ───────────────────────────────────────────────────────
const makeReference = (overrides?: Partial<ProjectReference>): ProjectReference => ({
  id: 'ref-1',
  project: 'proj-1',
  source_product: 'prod-1',
  image_url: 'https://example.com/ref.jpg',
  title: 'Cool Dog Shirt',
  asin: 'B0EXAMPLE1',
  prompt_analysis: null,
  position: 0,
  added_at: '2026-04-10T10:00:00Z',
  ...overrides,
});

// ── Tests ──────────────────────────────────────────────────────────
describe('ReferencesSection', () => {
  const defaultProps = {
    projectId: 'proj-1',
    onUseAsReference: vi.fn(),
    onUseAsPrompt: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no references', () => {
    renderWithProviders(
      <ReferencesSection {...defaultProps} references={[]} />,
    );
    expect(
      screen.getByText('Add references from Niche Pipeline'),
    ).toBeInTheDocument();
  });

  it('renders reference cards when references provided', () => {
    const refs = [
      makeReference({ id: 'ref-1', title: 'Dog Shirt' }),
      makeReference({ id: 'ref-2', title: 'Cat Hoodie' }),
    ];
    renderWithProviders(
      <ReferencesSection {...defaultProps} references={refs} />,
    );
    expect(screen.getByText('Dog Shirt')).toBeInTheDocument();
    expect(screen.getByText('Cat Hoodie')).toBeInTheDocument();
  });

  it('renders correct badge count (number of cards)', () => {
    const refs = [
      makeReference({ id: 'ref-1', title: 'Dog Shirt' }),
      makeReference({ id: 'ref-2', title: 'Cat Hoodie' }),
      makeReference({ id: 'ref-3', title: 'Bird Tank' }),
    ];
    renderWithProviders(
      <ReferencesSection {...defaultProps} references={refs} />,
    );
    // All 3 cards should be rendered
    expect(screen.getByText('Dog Shirt')).toBeInTheDocument();
    expect(screen.getByText('Cat Hoodie')).toBeInTheDocument();
    expect(screen.getByText('Bird Tank')).toBeInTheDocument();
  });

  it('calls removeReference mutation when remove clicked', async () => {
    const user = userEvent.setup();
    const refs = [makeReference()];

    renderWithProviders(
      <ReferencesSection {...defaultProps} references={refs} />,
    );

    const removeBtn = screen.getByLabelText('Remove');
    await user.click(removeBtn);

    expect(mockRemoveReference).toHaveBeenCalledWith({
      projectId: 'proj-1',
      referenceId: 'ref-1',
    });
  });

  it('calls analyzeImage mutation when analyze clicked', async () => {
    const user = userEvent.setup();
    const refs = [makeReference()];

    renderWithProviders(
      <ReferencesSection {...defaultProps} references={refs} />,
    );

    const analyzeBtn = screen.getByLabelText('Analyze');
    await user.click(analyzeBtn);

    expect(mockAnalyzeImage).toHaveBeenCalledWith({
      productId: 'prod-1',
      sourceImageUrl: 'https://example.com/ref.jpg',
      projectId: 'proj-1',
    });
  });

  it('calls onUseAsReference when "Use as Reference" clicked', async () => {
    const user = userEvent.setup();
    const refs = [makeReference()];

    renderWithProviders(
      <ReferencesSection {...defaultProps} references={refs} />,
    );

    const useRefBtn = screen.getByLabelText('Use as Reference');
    await user.click(useRefBtn);

    expect(defaultProps.onUseAsReference).toHaveBeenCalledWith(
      'https://example.com/ref.jpg',
    );
  });
});
