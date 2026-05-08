import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';

// PROJ-27: PanelMultiState calls useGetDesignsByIdsQuery for the
// Compare-carousel feature. Mock it so this Phase-O test doesn't need
// the full designApi middleware wired into the store.
vi.mock('@/store/designSlice', async (importActual) => {
  const actual = await importActual<typeof import('@/store/designSlice')>();
  return {
    ...actual,
    useGetDesignsByIdsQuery: () => ({ data: [], isLoading: false }),
  };
});

import PanelMultiState from '@/views/designs/board/partials/rightPanel/PanelMultiState';
import type { ArtboardData } from '@/views/designs/board/types';

const makeArtboard = (id: string, designId: string | null = null): ArtboardData => ({
  id,
  label: id,
  x: 0,
  y: 0,
  width: 400,
  height: 500,
  imageUrl: null,
  kind: 'regular',
  sourceId: null,
  designId,
  opacity: 100,
  backgroundColor: '#FFFFFF',
  clipContent: true,
  layers: [],
});

describe('PanelMultiState — Send to Listings (PROJ-9 Phase O)', () => {
  it('renders the Send button when onSendToListings is provided', () => {
    renderWithProviders(
      <PanelMultiState
        selectedArtboards={[makeArtboard('a1', 'd1'), makeArtboard('a2', 'd2')]}
        onAddToEditor={vi.fn()}
        onOpenInEditor={vi.fn()}
        onDeleteAll={vi.fn()}
        onExportSelected={vi.fn()}
        getSendableDesignIds={() => ['d1', 'd2']}
        onSendToListings={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Send to Listings/i })).toBeInTheDocument();
  });

  it('does NOT render Send button when onSendToListings is omitted', () => {
    renderWithProviders(
      <PanelMultiState
        selectedArtboards={[makeArtboard('a1', 'd1')]}
        onAddToEditor={vi.fn()}
        onOpenInEditor={vi.fn()}
        onDeleteAll={vi.fn()}
        onExportSelected={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Send to Listings/i })).not.toBeInTheDocument();
  });

  it('disables Send button when getSendableDesignIds returns empty', () => {
    renderWithProviders(
      <PanelMultiState
        selectedArtboards={[makeArtboard('a1', 'd1'), makeArtboard('a2', null)]}
        onAddToEditor={vi.fn()}
        onOpenInEditor={vi.fn()}
        onDeleteAll={vi.fn()}
        onExportSelected={vi.fn()}
        getSendableDesignIds={() => []}
        onSendToListings={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Send to Listings/i })).toBeDisabled();
  });

  it('calls onSendToListings with sendable design IDs (NOT artboard IDs)', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <PanelMultiState
        selectedArtboards={[
          makeArtboard('a1', 'd1'),
          makeArtboard('a2', 'd2'),
          makeArtboard('a3', null),
        ]}
        onAddToEditor={vi.fn()}
        onOpenInEditor={vi.fn()}
        onDeleteAll={vi.fn()}
        onExportSelected={vi.fn()}
        getSendableDesignIds={(ids) => ids.filter((id) => id !== 'a3').map((id) => `design-of-${id}`)}
        onSendToListings={onSend}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Send to Listings/i }));
    expect(onSend).toHaveBeenCalledWith(['design-of-a1', 'design-of-a2']);
  });
});
