/**
 * PROJ-30 T3.22 — Vitest for MobileKanbanTabs.
 *
 * Verifies:
 *   1. One tab is rendered per column (with column label + count badge).
 *   2. Clicking a tab switches the active panel (visible card changes).
 *   3. Each card has a 3-dot menu that opens a "Move to column…" entry.
 *   4. Selecting a destination column from the move menu fires
 *      `updateNiche` with the expected `status` payload.
 *
 * Drag-and-drop is intentionally NOT exercised here — dnd-kit drag is
 * out-of-scope for unit tests (covered indirectly by `useCardDrag` tests).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../utils/test-utils';
import MobileKanbanTabs from '../partials/MobileKanbanTabs';
import type { NicheCard as NicheCardType } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateNiche = vi.fn().mockReturnValue({ unwrap: vi.fn().mockResolvedValue({}) });

vi.mock('@/store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/nicheSlice')>();
  return {
    ...actual,
    useUpdateNicheMutation: () => [mockUpdateNiche, { isLoading: false }],
  };
});

// `NicheCard` reads workspace members from the store via `useAppSelector` —
// it's stable in tests under `renderWithProviders` defaults, no need to mock.

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const buildCard = (overrides?: Partial<NicheCardType>): NicheCardType => ({
  id: 'card-1',
  name: 'Card One',
  status: 'data_entry',
  current_round: 1,
  assigned_to: null,
  idea_count: 0,
  approved_idea_count: 0,
  design_count: 0,
  listing_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  ...overrides,
});

const buildColumns = () => [
  {
    id: 'research' as const,
    label: 'kanban.board.columnResearch',
    color: '#38BDF8',
    cards: [buildCard({ id: 'r1', name: 'Research Card One', status: 'data_entry' })],
  },
  {
    id: 'design' as const,
    label: 'kanban.board.columnDesign',
    color: '#00C8D7',
    cards: [
      buildCard({ id: 'd1', name: 'Design Card One', status: 'to_designer' }),
      buildCard({ id: 'd2', name: 'Design Card Two', status: 'to_designer' }),
    ],
  },
  {
    id: 'publish' as const,
    label: 'kanban.board.columnPublish',
    color: '#F59E0B',
    cards: [],
  },
];

const defaultProps = {
  columns: buildColumns(),
  onCardClick: vi.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MobileKanbanTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders one tab per column with count badge', () => {
    renderWithProviders(<MobileKanbanTabs {...defaultProps} />);

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);

    // Column labels resolve through i18n in test-utils
    expect(within(tabs[0]).getByText('Research')).toBeInTheDocument();
    expect(within(tabs[1]).getByText('Design')).toBeInTheDocument();
    expect(within(tabs[2]).getByText('Publish')).toBeInTheDocument();

    // Badge counts (Research=1, Design=2, Publish=0 — `showZero` keeps the 0)
    expect(within(tabs[0]).getByText('1')).toBeInTheDocument();
    expect(within(tabs[1]).getByText('2')).toBeInTheDocument();
    expect(within(tabs[2]).getByText('0')).toBeInTheDocument();
  });

  it('clicking a tab switches the active panel', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileKanbanTabs {...defaultProps} />);

    // First tab active by default — Research card visible
    expect(screen.getByText('Research Card One')).toBeInTheDocument();
    expect(screen.queryByText('Design Card One')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('tab')[1]);

    expect(screen.queryByText('Research Card One')).not.toBeInTheDocument();
    expect(screen.getByText('Design Card One')).toBeInTheDocument();
    expect(screen.getByText('Design Card Two')).toBeInTheDocument();
  });

  it('opens a 3-dot menu with a "Move to column" entry on each card', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileKanbanTabs {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /actions for research card one/i });
    await user.click(menuButton);

    expect(await screen.findByRole('menuitem', { name: /move to column/i })).toBeInTheDocument();
  });

  it('dispatches updateNiche with the new status when a destination column is selected', async () => {
    const user = userEvent.setup();
    renderWithProviders(<MobileKanbanTabs {...defaultProps} />);

    // Open card menu on the active Research column
    await user.click(screen.getByRole('button', { name: /actions for research card one/i }));
    await user.click(await screen.findByRole('menuitem', { name: /move to column/i }));

    // Submenu now lists every OTHER column; pick "Design" (→ status `to_designer`)
    const designItem = await screen.findByRole('menuitem', { name: /design/i });
    await user.click(designItem);

    expect(mockUpdateNiche).toHaveBeenCalledTimes(1);
    expect(mockUpdateNiche).toHaveBeenCalledWith({
      id: 'r1',
      body: { status: 'to_designer' },
    });
  });
});
