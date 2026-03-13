import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { NicheTable } from '../partials/NicheTable';
import type { Niche } from '../types';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';
import type { UseInlineEditReturn } from '../hooks/useInlineEdit';
import type { UseInlineAddReturn } from '../hooks/useInlineAdd';

// The InlineAddRow uses useCreateNicheMutation — mock to avoid RTK setup
vi.mock('../partials/InlineAddRow', () => ({
  InlineAddRow: () => <tr data-testid="inline-add-row"><td /></tr>,
}));

const buildNiche = (overrides?: Partial<Niche>): Niche => ({
  id: 'niche-1',
  workspace: 'ws-1',
  name: 'Hiking Gifts',
  notes: '',
  status: 'data_entry',
  potential_rating: null,
  research_status: null,
  research_run_id: null,
  position: 0,
  assigned_to: null,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  idea_count: 5,
  approved_idea_count: 2,
  ...overrides,
});

const makeSelection = (overrides?: Partial<UseNicheSelectionReturn>): UseNicheSelectionReturn => ({
  selectedIds: new Set(),
  selectedCount: 0,
  isSelected: vi.fn(() => false),
  toggleOne: vi.fn(),
  toggleAll: vi.fn(),
  clearSelection: vi.fn(),
  ...overrides,
});

const makeInlineEdit = (overrides?: Partial<UseInlineEditReturn>): UseInlineEditReturn => ({
  activeCell: null,
  isSaving: false,
  activateCell: vi.fn(),
  deactivateCell: vi.fn(),
  saveName: vi.fn(),
  saveStatus: vi.fn(),
  savePotentialRating: vi.fn(),
  saveAssignee: vi.fn(),
  ...overrides,
});

const makeInlineAdd = (overrides?: Partial<UseInlineAddReturn>): UseInlineAddReturn => ({
  isActive: false,
  isCreating: false,
  error: null,
  activate: vi.fn(),
  cancel: vi.fn(),
  submit: vi.fn(),
  ...overrides,
});

const defaultProps = {
  niches: [buildNiche()],
  ordering: '' as const,
  onOrderingChange: vi.fn(),
  selection: makeSelection(),
  onRowClick: vi.fn(),
  onArchive: vi.fn(),
  inlineEdit: makeInlineEdit(),
  inlineAdd: makeInlineAdd(),
};

describe('NicheTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a row for each niche', () => {
    const niches = [buildNiche({ id: 'n1', name: 'Niche One' }), buildNiche({ id: 'n2', name: 'Niche Two' })];
    renderWithProviders(<NicheTable {...defaultProps} niches={niches} />);
    expect(screen.getByText('Niche One')).toBeInTheDocument();
    expect(screen.getByText('Niche Two')).toBeInTheDocument();
  });

  it('renders correct ideas count in format "approved / total"', () => {
    const niche = buildNiche({ idea_count: 10, approved_idea_count: 3 });
    renderWithProviders(<NicheTable {...defaultProps} niches={[niche]} />);
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
  });

  it('renders column headers', () => {
    renderWithProviders(<NicheTable {...defaultProps} />);
    expect(screen.getByText(/name/i)).toBeInTheDocument();
    expect(screen.getByText(/status/i)).toBeInTheDocument();
    expect(screen.getByText(/ideas/i)).toBeInTheDocument();
    expect(screen.getByText(/updated/i)).toBeInTheDocument();
  });

  it('select-all checkbox calls toggleAll with all niche ids', async () => {
    const toggleAll = vi.fn();
    const selection = makeSelection({ toggleAll });
    const niches = [buildNiche({ id: 'a' }), buildNiche({ id: 'b' })];
    renderWithProviders(<NicheTable {...defaultProps} niches={niches} selection={selection} />);

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all niches/i });
    await userEvent.click(selectAllCheckbox);

    expect(toggleAll).toHaveBeenCalledWith(['a', 'b']);
  });

  it('renders the InlineAddRow', () => {
    renderWithProviders(<NicheTable {...defaultProps} />);
    expect(screen.getByTestId('inline-add-row')).toBeInTheDocument();
  });

  it('shows archive option in context menu after clicking ⋮ button', async () => {
    renderWithProviders(<NicheTable {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /actions/i });
    await userEvent.click(menuButton);

    expect(await screen.findByText(/archive/i)).toBeInTheDocument();
  });

  it('opens archive confirmation dialog when Archive menu item is clicked', async () => {
    renderWithProviders(<NicheTable {...defaultProps} />);

    const menuButton = screen.getByRole('button', { name: /actions/i });
    await userEvent.click(menuButton);

    const archiveItem = await screen.findByRole('menuitem', { name: /archive/i });
    await userEvent.click(archiveItem);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/archive this niche/i)).toBeInTheDocument();
  });

  it('calls onArchive when archive confirmation is confirmed', async () => {
    const onArchive = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(<NicheTable {...defaultProps} onArchive={onArchive} />);

    // Open menu
    await userEvent.click(screen.getByRole('button', { name: /actions/i }));
    const archiveItem = await screen.findByRole('menuitem', { name: /archive/i });
    await userEvent.click(archiveItem);

    // Confirm dialog
    const confirmButton = await screen.findByRole('button', { name: /^archive$/i });
    await userEvent.click(confirmButton);

    await waitFor(() => expect(onArchive).toHaveBeenCalledWith('niche-1'));
  });

  it('double-click on row calls onRowClick with the niche id', async () => {
    const onRowClick = vi.fn();
    renderWithProviders(<NicheTable {...defaultProps} onRowClick={onRowClick} />);

    const row = screen.getByRole('row', { name: /hiking gifts/i });
    fireEvent.dblClick(row);

    expect(onRowClick).toHaveBeenCalledWith('niche-1');
  });

  it('name column sort label triggers onOrderingChange with "name"', async () => {
    const onOrderingChange = vi.fn();
    renderWithProviders(
      <NicheTable {...defaultProps} ordering="" onOrderingChange={onOrderingChange} />,
    );

    await userEvent.click(screen.getByText('Name'));
    expect(onOrderingChange).toHaveBeenCalledWith('name');
  });

  it('updated column sort label triggers onOrderingChange with "updated_at"', async () => {
    const onOrderingChange = vi.fn();
    renderWithProviders(
      <NicheTable {...defaultProps} ordering="" onOrderingChange={onOrderingChange} />,
    );

    await userEvent.click(screen.getByText('Updated'));
    expect(onOrderingChange).toHaveBeenCalledWith('updated_at');
  });
});
