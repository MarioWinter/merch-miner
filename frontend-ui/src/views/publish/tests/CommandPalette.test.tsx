import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import CommandPalette from '../partials/command/CommandPalette';
import type { MatchedAction } from '../hooks/useCommandPalette';

// ---------------------------------------------------------------------------
// Helpers — build MatchedAction fixtures. Column values 0/1/2 match the
// 3-column grid layout; `context` is consumed by the hook filter, not by the
// palette component itself. We still attach representative contexts so that
// assertions mirror production wiring.
// ---------------------------------------------------------------------------

const makeAction = (overrides: Partial<MatchedAction> = {}): MatchedAction => ({
  id: 'edit-bulk',
  label: 'Edit in Bulk',
  icon: 'EditOutlined',
  category: 'LISTING',
  column: 0,
  context: ['listing'],
  action: vi.fn(),
  highlightRanges: [],
  ...overrides,
});

const col0Actions: MatchedAction[] = [
  makeAction({ id: 'edit-bulk', label: 'Edit in Bulk', column: 0, category: 'LISTING' }),
  makeAction({ id: 'duplicate', label: 'Duplicate', column: 0, category: 'LISTING' }),
  makeAction({
    id: 'convert-from-global',
    label: 'Convert from Global',
    column: 0,
    category: 'CONVERT',
    context: ['mba'],
  }),
  makeAction({
    id: 'convert-from-mba',
    label: 'Convert from MBA',
    column: 0,
    category: 'CONVERT',
    context: ['global'],
  }),
];

const col1Actions: MatchedAction[] = [
  makeAction({ id: 'export-csv', label: 'Export as CSV', column: 1, category: 'EXPORT', context: undefined }),
];

const col2Actions: MatchedAction[] = [
  makeAction({
    id: 'copy-colors-from',
    label: 'Copy Colors From...',
    column: 2,
    category: 'TEMPLATES',
    context: ['colors'],
  }),
];

const allActions = [...col0Actions, ...col1Actions, ...col2Actions];

// ---------------------------------------------------------------------------
// Default props — a closed palette baseline that each test overrides.
// ---------------------------------------------------------------------------

const baseProps = () => ({
  open: true,
  query: '',
  onQueryChange: vi.fn(),
  context: null as string | null,
  activeIndex: 0,
  matched: allActions,
  recentActions: [] as MatchedAction[],
  flatActions: allActions,
  onKeyDown: vi.fn(),
  onExecute: vi.fn(),
  onClose: vi.fn(),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandPalette', () => {
  it('renders all three columns when browsing (no query / no context)', () => {
    renderWithProviders(<CommandPalette {...baseProps()} />);

    // Every action in `matched` is rendered as a role="option".
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(allActions.length);

    // Category labels drawn from the fixture data.
    expect(screen.getByText('LISTING')).toBeInTheDocument();
    expect(screen.getByText('EXPORT')).toBeInTheDocument();
    expect(screen.getByText('TEMPLATES')).toBeInTheDocument();
    expect(screen.getByText('CONVERT')).toBeInTheDocument();
  });

  it('filters options when a query is typed (search column layout)', () => {
    // Parent filters matched/flatActions based on query — we mirror that by
    // passing only the "convert" actions through.
    const convertActions = allActions.filter((a) => a.label.startsWith('Convert'));
    const props = {
      ...baseProps(),
      query: 'convert',
      matched: convertActions,
      flatActions: convertActions,
    };
    renderWithProviders(<CommandPalette {...props} />);

    // Only the 2 convert actions are rendered.
    expect(screen.getByText('Convert from Global')).toBeInTheDocument();
    expect(screen.getByText('Convert from MBA')).toBeInTheDocument();
    expect(screen.queryByText('Edit in Bulk')).not.toBeInTheDocument();
    expect(screen.queryByText('Export as CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Copy Colors From...')).not.toBeInTheDocument();
  });

  it('invokes onExecute when an action row is clicked', () => {
    const onExecute = vi.fn();
    renderWithProviders(<CommandPalette {...baseProps()} onExecute={onExecute} />);

    fireEvent.click(screen.getByText('Edit in Bulk'));

    expect(onExecute).toHaveBeenCalledTimes(1);
    expect(onExecute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'edit-bulk' }),
    );
  });

  it('forwards keyboard events to onKeyDown (Enter triggers parent handler)', () => {
    const onKeyDown = vi.fn();
    renderWithProviders(<CommandPalette {...baseProps()} onKeyDown={onKeyDown} />);

    // Keyboard dispatch bubbles up to the palette container (role=listbox).
    // The hook's keyboard handler — not the component — resolves Enter to
    // `executeAction(flatActions[activeIndex])`, so we only assert wiring.
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'Enter' });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0][0].key).toBe('Enter');
  });

  it("context='mba' hides MBA-source convert action (filtered by parent hook)", () => {
    // The palette itself does not filter — the parent hook does. With
    // context='mba' only actions that include 'mba' in their context survive.
    // We exercise the parent contract by passing the pre-filtered list.
    const mbaContext = allActions.filter((a) => a.context?.includes('mba'));
    const props = {
      ...baseProps(),
      context: 'mba' as string | null,
      matched: mbaContext,
      flatActions: mbaContext,
    };
    renderWithProviders(<CommandPalette {...props} />);

    // 'Convert from Global' targets MBA (context: ['mba']) — kept.
    expect(screen.getByText('Convert from Global')).toBeInTheDocument();
    // 'Convert from MBA' targets Global (context: ['global']) — hidden.
    expect(screen.queryByText('Convert from MBA')).not.toBeInTheDocument();
    // Non-mba context actions are also hidden.
    expect(screen.queryByText('Export as CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Copy Colors From...')).not.toBeInTheDocument();
  });
});
