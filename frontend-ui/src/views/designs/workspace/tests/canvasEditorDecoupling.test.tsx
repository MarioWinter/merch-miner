import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';

// PROJ-27: PanelMultiState added a useGetDesignsByIdsQuery call for the
// Compare-carousel — mock so this decoupling test doesn't need the full
// designApi middleware.
vi.mock('@/store/designSlice', async (importActual) => {
  const actual = await importActual<typeof import('@/store/designSlice')>();
  return {
    ...actual,
    useGetDesignsByIdsQuery: () => ({ data: [], isLoading: false }),
  };
});

import PanelMultiState from '../../board/partials/rightPanel/PanelMultiState';
import type { ArtboardData } from '../../board/types';

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const makeArtboard = (overrides: Partial<ArtboardData> = {}): ArtboardData => ({
  id: `ab-${Math.random().toString(36).slice(2, 6)}`,
  label: 'Artboard 1',
  x: 0,
  y: 0,
  width: 400,
  height: 500,
  imageUrl: 'blob:http://localhost/test-img',
  kind: 'regular',
  sourceId: null,
  designId: null,
  opacity: 100,
  backgroundColor: '#FFFFFF',
  clipContent: true,
  layers: [],
  ...overrides,
});

// -----------------------------------------------------------------
// Tests: "Open in Editor" from PanelMultiState
// -----------------------------------------------------------------

describe('PanelMultiState: Open in Editor', () => {
  const onOpenInEditor = vi.fn();
  const onDeleteAll = vi.fn();
  const onExportSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onOpenInEditor with selected artboard IDs when button clicked', async () => {
    const user = userEvent.setup();
    const artboards = [makeArtboard({ id: 'ab-3' })];

    renderWithProviders(
      <PanelMultiState
        selectedArtboards={artboards}
        onOpenInEditor={onOpenInEditor}
        onDeleteAll={onDeleteAll}
        onExportSelected={onExportSelected}
      />,
    );

    const openBtn = screen.getByLabelText(/Open in Editor/i);
    await user.click(openBtn);

    expect(onOpenInEditor).toHaveBeenCalledTimes(1);
    expect(onOpenInEditor).toHaveBeenCalledWith(['ab-3']);
  });
});
