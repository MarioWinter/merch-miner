import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { DesignAsset } from '../types';
import DesignCardGrid from '../partials/grid/DesignCardGrid';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDesign = (overrides: Partial<DesignAsset> = {}): DesignAsset => ({
  id: 'design-1',
  workspace: 'ws-1',
  file_name: 'shirt.png',
  file_url: 'https://cdn.example/shirt.png',
  source: 'upload',
  source_file_id: '',
  thumbnail_url: '',
  dimensions: { width: 1000, height: 1000 },
  file_size: 1024,
  tags: [],
  listing: null,
  idea: null,
  niche: null,
  collection: null,
  round: 1,
  created_by: 'user-1',
  created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const designs = [
  makeDesign({ id: 'd-1', file_name: 'one.png' }),
  makeDesign({ id: 'd-2', file_name: 'two.png' }),
  makeDesign({ id: 'd-3', file_name: 'three.png' }),
];

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  designs,
  viewMode: 'grid' as const,
  isLoading: false,
  isSelected: () => false,
  hasSelection: false,
  onSelect: vi.fn(),
  onLassoSelect: vi.fn(),
  onAddDesigns: vi.fn(),
  onDuplicate: vi.fn(),
  onMove: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DesignCardGrid', () => {
  it('renders grid view with a DesignCard per asset plus the Add card', () => {
    renderWithProviders(<DesignCardGrid {...makeProps()} />);

    // One thumbnail <img alt> per design — the CardRoot wraps the <img>.
    for (const d of designs) {
      expect(screen.getByAltText(d.file_name)).toBeInTheDocument();
    }
    // AddDesignsCard renders a role="button" with aria-label "Add designs".
    expect(
      screen.getByRole('button', { name: /add designs/i }),
    ).toBeInTheDocument();
  });

  it('renders list view variant using DesignListRow (no AddDesignsCard in list)', () => {
    renderWithProviders(
      <DesignCardGrid {...makeProps({ viewMode: 'list' })} />,
    );

    // List view still shows the file names (via noWrap <Typography>) and a
    // checkbox per row — the grid container + AddDesignsCard are replaced by
    // ListContainer with DesignListRow instances.
    for (const d of designs) {
      expect(screen.getByText(d.file_name)).toBeInTheDocument();
    }
    // ListRow checkboxes expose aria-label "Select design"; grid variant has
    // the same label but the AddDesignsCard button is absent in list.
    expect(
      screen.queryByRole('button', { name: /add designs/i }),
    ).not.toBeInTheDocument();
  });

  it('fires onSelect with asset id + shift flag when a card is clicked', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <DesignCardGrid {...makeProps({ onSelect })} />,
    );

    // Clicking anywhere on the card (CardRoot's onClick) invokes onSelect with
    // the asset id and the shift modifier state from the event.
    const img = screen.getByAltText('one.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    expect(card).not.toBeNull();

    // Plain click — shift=false.
    fireEvent.click(card, { shiftKey: false });
    expect(onSelect).toHaveBeenLastCalledWith('d-1', false);

    // Shift-click — shift=true for range selection.
    fireEvent.click(card, { shiftKey: true });
    expect(onSelect).toHaveBeenLastCalledWith('d-1', true);
  });

  it('opens the 3-dot menu and fires onEditSingle when Edit is clicked', () => {
    const onEditSingle = vi.fn();
    renderWithProviders(
      <DesignCardGrid {...makeProps({ onEditSingle })} />,
    );

    const img = screen.getByAltText('one.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    const menuButton = within(card).getByRole('button', { name: /open card menu/i });
    fireEvent.click(menuButton);

    // Menu renders in a portal — query screen (not card) for the items.
    const editItem = screen.getByRole('menuitem', { name: /^edit$/i });
    fireEvent.click(editItem);

    expect(onEditSingle).toHaveBeenCalledTimes(1);
    expect(onEditSingle).toHaveBeenCalledWith('d-1');
  });

  it('fires onDeleteSingle with the asset id when the Delete menu item is clicked (H5 / AC-64)', () => {
    // AC-64: the 3-dot menu's Delete entry must fire `onDeleteSingle` with the
    // card's asset id so PublishView can open its ConfirmDialog. This isolates
    // the wiring between DesignCardMenu → DesignCard → DesignCardGrid; the
    // actual mutation is covered in PublishView.delete.test.tsx.
    const onDeleteSingle = vi.fn();
    renderWithProviders(
      <DesignCardGrid {...makeProps({ onDeleteSingle })} />,
    );

    const img = screen.getByAltText('two.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    const menuButton = within(card).getByRole('button', { name: /open card menu/i });
    fireEvent.click(menuButton);

    const deleteItem = screen.getByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteItem);

    expect(onDeleteSingle).toHaveBeenCalledTimes(1);
    expect(onDeleteSingle).toHaveBeenCalledWith('d-2');
  });

  it('fires onDuplicate with the asset id when the Duplicate menu item is clicked (H6 / AC-66)', () => {
    // AC-66: Duplicate in the 3-dot menu triggers the same onDuplicate callback
    // as the hover action, passing the card's asset id through to PublishView.
    const onDuplicate = vi.fn();
    renderWithProviders(
      <DesignCardGrid {...makeProps({ onDuplicate })} />,
    );

    const img = screen.getByAltText('three.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    const menuButton = within(card).getByRole('button', { name: /open card menu/i });
    fireEvent.click(menuButton);

    const dupItem = screen.getByRole('menuitem', { name: /^duplicate$/i });
    fireEvent.click(dupItem);

    // Hover action also calls onDuplicate with the id, so we compare the last
    // call — the menu click is the one under test.
    expect(onDuplicate).toHaveBeenLastCalledWith('d-3');
  });

  it('fires onMove with the asset id when the Move menu item is clicked (H7 / AC-67)', () => {
    // AC-67: Move to Collection opens the MovePickerDialog via the onMove prop.
    const onMove = vi.fn();
    renderWithProviders(
      <DesignCardGrid {...makeProps({ onMove })} />,
    );

    const img = screen.getByAltText('one.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    const menuButton = within(card).getByRole('button', { name: /open card menu/i });
    fireEvent.click(menuButton);

    const moveItem = screen.getByRole('menuitem', { name: /move to collection/i });
    fireEvent.click(moveItem);

    expect(onMove).toHaveBeenLastCalledWith('d-1');
  });

  it('exposes hover action buttons (Duplicate + Move) when callbacks provided', () => {
    // Hover is CSS-driven (opacity 0 → 1), so visibility is asserted via the
    // DOM presence + aria-label of the action icons. jsdom does not apply the
    // :hover styles so we assert the underlying markup — behaviourally the
    // buttons are wired regardless of visible opacity.
    renderWithProviders(<DesignCardGrid {...makeProps()} />);

    const img = screen.getByAltText('one.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    expect(
      within(card).getByRole('button', { name: /duplicate/i }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: /^move$/i }),
    ).toBeInTheDocument();
  });
});
