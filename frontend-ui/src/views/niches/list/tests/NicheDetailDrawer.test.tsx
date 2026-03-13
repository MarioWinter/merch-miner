import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import { renderWithProviders } from '../../../../utils/test-utils';
import { NicheDetailDrawer } from '../partials/NicheDetailDrawer';
import { nicheApi } from '../../../../store/nicheSlice';
import authReducer from '../../../../store/authSlice';
import workspaceReducer from '../../../../store/workspaceSlice';
import type { Niche } from '../types';

// Shared mock handlers for RTK Query endpoints
const mockCreateNiche = vi.fn();
const mockUpdateNiche = vi.fn();
const mockDeleteNiche = vi.fn();
const mockGetNiche = vi.fn();

vi.mock('../../../../store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../store/nicheSlice')>();
  return {
    ...actual,
    useCreateNicheMutation: () => [mockCreateNiche, { isLoading: false }],
    useUpdateNicheMutation: () => [mockUpdateNiche, { isLoading: false }],
    useDeleteNicheMutation: () => [mockDeleteNiche, { isLoading: false }],
    useGetNicheQuery: (id: string, opts: { skip?: boolean }) => {
      if (opts?.skip) return { data: undefined, isFetching: false };
      return mockGetNiche(id);
    },
  };
});

const mockNiche: Niche = {
  id: 'niche-abc',
  workspace: 'ws-1',
  name: 'Yoga Gifts',
  notes: 'Some notes',
  status: 'data_entry',
  potential_rating: null,
  research_status: null,
  research_run_id: null,
  position: 0,
  assigned_to: null,
  created_by: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  idea_count: 4,
  approved_idea_count: 1,
};

const renderDrawer = (props: {
  open: boolean;
  mode: 'create' | 'edit';
  selectedId?: string | null;
  onClose?: () => void;
}) => {
  return renderWithProviders(
    <NicheDetailDrawer
      open={props.open}
      mode={props.mode}
      selectedId={props.selectedId ?? null}
      onClose={props.onClose ?? vi.fn()}
    />,
  );
};

describe('NicheDetailDrawer — create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "New Niche" header', () => {
    renderDrawer({ open: true, mode: 'create' });
    expect(screen.getByText('New Niche')).toBeInTheDocument();
  });

  it('renders Name and Notes fields', () => {
    renderDrawer({ open: true, mode: 'create' });
    expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /notes/i })).toBeInTheDocument();
  });

  it('does not call createNiche when Name is empty', async () => {
    mockCreateNiche.mockReturnValue({ unwrap: () => Promise.resolve({}) });
    renderDrawer({ open: true, mode: 'create' });

    // Submit the form without entering a name — press Enter in the name field
    const nameInput = screen.getByRole('textbox', { name: /name/i });
    await userEvent.click(nameInput);
    await userEvent.keyboard('{Enter}');

    // Give any async validation time to settle
    await waitFor(() => expect(mockCreateNiche).not.toHaveBeenCalled());
  });

  it('calls createNiche with name and notes on valid submit', async () => {
    mockCreateNiche.mockReturnValue({ unwrap: () => Promise.resolve(mockNiche) });
    renderDrawer({ open: true, mode: 'create' });

    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'New Niche Name');
    await userEvent.click(screen.getByRole('button', { name: /create niche/i }));

    await waitFor(() =>
      expect(mockCreateNiche).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Niche Name' }),
      ),
    );
  });

  it('renders Cancel button in footer', () => {
    renderDrawer({ open: true, mode: 'create' });
    // getAllByRole since close icon also has aria-label="Cancel"
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    expect(cancelButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onClose when footer Cancel is clicked', async () => {
    const onClose = vi.fn();
    renderDrawer({ open: true, mode: 'create', onClose });
    // The footer Cancel is a text button (not an IconButton) — target by its text
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    // Footer cancel has no icon child — it is the one without a data-testid child
    // The last Cancel button in DOM is typically the footer one
    await userEvent.click(cancelButtons[cancelButtons.length - 1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('NicheDetailDrawer — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetNiche.mockReturnValue({ data: mockNiche, isFetching: false });
  });

  it('pre-fills name from niche data', async () => {
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() =>
      expect(screen.getByDisplayValue('Yoga Gifts')).toBeInTheDocument(),
    );
  });

  it('renders status and potential rating selects', async () => {
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() => screen.getByDisplayValue('Yoga Gifts'));
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Potential rating')).toBeInTheDocument();
  });

  it('renders ideas badge with correct counts', async () => {
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() => screen.getByDisplayValue('Yoga Gifts'));
    expect(screen.getByText(/4 ideas.*1 approved/i)).toBeInTheDocument();
  });

  it('renders Archive and Save Changes buttons', async () => {
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() => screen.getByDisplayValue('Yoga Gifts'));
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('opens archive confirmation dialog when Archive is clicked', async () => {
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() => screen.getByRole('button', { name: /archive/i }));

    await userEvent.click(screen.getByRole('button', { name: /archive/i }));

    expect(await screen.findByText(/archive this niche/i)).toBeInTheDocument();
  });

  it('calls deleteNiche when archive confirmation is confirmed', async () => {
    mockDeleteNiche.mockReturnValue({ unwrap: () => Promise.resolve(undefined) });
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() => screen.getByRole('button', { name: /archive/i }));

    await userEvent.click(screen.getByRole('button', { name: /archive/i }));

    const confirmBtn = await screen.findByRole('button', { name: /^archive$/i });
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(mockDeleteNiche).toHaveBeenCalledWith('niche-abc'));
  });

  it('displays server error Alert when createNiche rejects with detail', async () => {
    // Re-render in create mode with error
    mockCreateNiche.mockReturnValue({
      unwrap: () => Promise.reject({ data: { detail: 'Set potential rating first.' } }),
    });

    renderDrawer({ open: true, mode: 'create' });

    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Some Name');
    await userEvent.click(screen.getByRole('button', { name: /create niche/i }));

    await waitFor(() =>
      expect(screen.getByText('Set potential rating first.')).toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('opens unsaved-changes dialog when closing with dirty edit form', async () => {
    renderDrawer({ open: true, mode: 'edit', selectedId: 'niche-abc' });
    await waitFor(() => screen.getByDisplayValue('Yoga Gifts'));

    // Dirty the form
    const nameInput = screen.getByDisplayValue('Yoga Gifts');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Changed Name');

    // Click the close X icon button (first "cancel"-named button is the IconButton)
    const cancelButtons = screen.getAllByRole('button', { name: /cancel/i });
    await userEvent.click(cancelButtons[0]);

    expect(await screen.findByRole('heading', { name: /unsaved changes/i })).toBeInTheDocument();
  });
});
