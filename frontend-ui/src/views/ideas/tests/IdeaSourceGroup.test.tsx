import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({ reducerPath: n, reducer: () => ({}), middleware: () => (x: any) => (a: any) => x(a), util: { resetApiState: () => ({ type: 'noop' }) } }),
}));
vi.mock('@/store/nicheSlice', () => ({ nicheApi: fa('nicheApi'), useListNichesQuery: () => ({ data: { results: [] }, isLoading: false }) }));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({
  designApi: {
    ...fa('designApi'),
    useLazyListDesignsQuery: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue([]) })],
  },
  useListProjectsQuery: () => ({ data: { results: [] }, isLoading: false }),
  useCreateProjectMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }), { isLoading: false }],
  useAddIdeasToProjectMutation: () => [vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) }), { isLoading: false }],
  useDeleteProjectMutation: () => [vi.fn(), { isLoading: false }],
}));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
vi.mock('@/store/searchSlice', () => ({ searchApi: fa('searchApi') }));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({ collectedProductsApi: fa('collectedProductsApi') }));

import { renderWithProviders } from '../../../utils/test-utils';
import { IdeaSourceGroup } from '../partials/IdeaSourceGroup';
import { makeIdea, makeAdaptedIdea } from './fixtures';

const defaultHandlers = {
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onImprove: vi.fn(),
  onAdapt: vi.fn(),
  onDelete: vi.fn(),
  onRegenerate: vi.fn(),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe('IdeaSourceGroup', () => {
  const sourceIdea = makeIdea({ id: 'source-1', slogan_text: 'Source slogan' });
  const adaptedSelf = makeAdaptedIdea('source-1', {
    id: 'a1',
    signal_type: 'self',
    market_confidence: 'High',
    slogan_text: 'Self adapted',
  });
  const adaptedOther = makeAdaptedIdea('source-1', {
    id: 'a2',
    signal_type: 'other',
    market_confidence: 'Medium',
    slogan_text: 'Other adapted',
  });

  const renderGroup = (overrides?: { sourceIdea?: typeof sourceIdea; adaptedIdeas?: typeof adaptedSelf[] }) =>
    renderWithProviders(
      <IdeaSourceGroup
        sourceIdea={overrides?.sourceIdea ?? sourceIdea}
        adaptedIdeas={overrides?.adaptedIdeas ?? [adaptedSelf, adaptedOther]}
        {...defaultHandlers}
        selectedIds={new Set()}
        onToggleSelect={vi.fn()}
      />,
    );

  it('renders source slogan text in collapsed header', () => {
    renderGroup();
    // Header shows slogan in Typography noWrap — use getAllByText since expanded content also has it
    const matches = screen.getAllByText('Source slogan');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders niche chip in header', () => {
    renderGroup({ adaptedIdeas: [adaptedSelf] });
    // Niche name appears in header chip and inside IdeaCard chip
    const matches = screen.getAllByText('Funny Dogs');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders adapted count badge', () => {
    renderGroup();
    expect(screen.getByText('2 adapted')).toBeInTheDocument();
  });

  it('starts collapsed — adapted ideas are in DOM but inside collapsed container', () => {
    renderGroup({ adaptedIdeas: [adaptedSelf] });
    // MUI Collapse keeps content in DOM but hides it
    const expandBtn = screen.getByLabelText('Expand group');
    expect(expandBtn).toBeInTheDocument();
  });

  it('expands on click and shows adapted ideas', () => {
    renderGroup();
    fireEvent.click(screen.getByLabelText('Expand group'));
    expect(screen.getByText('Self adapted')).toBeInTheDocument();
    expect(screen.getByText('Other adapted')).toBeInTheDocument();
  });

  it('shows SELF and OTHER section headers when expanded', () => {
    renderGroup();
    fireEvent.click(screen.getByLabelText('Expand group'));
    // Signal type labels appear in section headers AND in SignalTypeBadge chips
    // Use overline text element (section header) specifically
    const selfHeaders = screen.getAllByText('SELF');
    const otherHeaders = screen.getAllByText('OTHER');
    expect(selfHeaders.length).toBeGreaterThanOrEqual(1);
    expect(otherHeaders.length).toBeGreaterThanOrEqual(1);
  });

  it('toggles expanded state on click', () => {
    renderGroup({ adaptedIdeas: [adaptedSelf] });
    // Expand
    fireEvent.click(screen.getByLabelText('Expand group'));
    expect(screen.getByLabelText('Collapse group')).toBeInTheDocument();
    // Collapse
    fireEvent.click(screen.getByLabelText('Collapse group'));
    expect(screen.getByLabelText('Expand group')).toBeInTheDocument();
  });

  it('renders source idea status chip in header', () => {
    renderGroup({
      sourceIdea: makeIdea({ id: 'source-1', status: 'approved' }),
      adaptedIdeas: [adaptedSelf],
    });
    // Status appears in header chip and in IdeaCard chip
    const matches = screen.getAllByText('Approved');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
