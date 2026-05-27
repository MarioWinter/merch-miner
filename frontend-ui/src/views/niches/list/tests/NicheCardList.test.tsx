import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import { NicheCardList } from '../partials/NicheCardList';
import type { Niche } from '../types';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';

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
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  idea_count: 5,
  approved_idea_count: 2,
  ...overrides,
});

const makeSelection = (
  overrides?: Partial<UseNicheSelectionReturn>,
): UseNicheSelectionReturn => ({
  selectedIds: new Set(),
  selectedCount: 0,
  isSelected: vi.fn(() => false),
  toggleOne: vi.fn(),
  toggleAll: vi.fn(),
  clearSelection: vi.fn(),
  ...overrides,
});

const defaultProps = {
  niches: [
    buildNiche({ id: 'n1', name: 'Niche One' }),
    buildNiche({ id: 'n2', name: 'Niche Two' }),
    buildNiche({ id: 'n3', name: 'Niche Three' }),
  ],
  selection: makeSelection(),
  onRowClick: vi.fn(),
  onArchive: vi.fn(),
};

describe('NicheCardList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a card for each niche', () => {
    renderWithProviders(<NicheCardList {...defaultProps} />);
    expect(screen.getByText('Niche One')).toBeInTheDocument();
    expect(screen.getByText('Niche Two')).toBeInTheDocument();
    expect(screen.getByText('Niche Three')).toBeInTheDocument();
  });

  it('clicking checkbox fires toggleOne with the niche id', async () => {
    const toggleOne = vi.fn();
    const selection = makeSelection({ toggleOne });
    renderWithProviders(<NicheCardList {...defaultProps} selection={selection} />);

    const checkbox = screen.getByRole('checkbox', { name: /select niche one/i });
    await userEvent.click(checkbox);

    expect(toggleOne).toHaveBeenCalledWith('n1');
  });

  it('clicking the card body fires onRowClick with the niche id', async () => {
    const onRowClick = vi.fn();
    renderWithProviders(<NicheCardList {...defaultProps} onRowClick={onRowClick} />);

    await userEvent.click(screen.getByText('Niche Two'));

    expect(onRowClick).toHaveBeenCalledWith('n2');
  });

  it('shows archive option in 3-dot menu and opens confirmation dialog', async () => {
    renderWithProviders(<NicheCardList {...defaultProps} />);

    const menuButton = screen.getAllByRole('button', { name: /actions for niche one/i })[0];
    await userEvent.click(menuButton);

    const archiveItem = await screen.findByRole('menuitem', { name: /archive/i });
    await userEvent.click(archiveItem);

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
