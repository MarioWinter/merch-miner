import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
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
// Tests: "Add to Editor" from PanelMultiState
// -----------------------------------------------------------------

describe('PanelMultiState: Add to Editor', () => {
  const onAddToEditor = vi.fn();
  const onOpenInEditor = vi.fn();
  const onDeleteAll = vi.fn();
  const onExportSelected = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls onAddToEditor with selected artboard IDs when button clicked', async () => {
    const user = userEvent.setup();
    const artboards = [makeArtboard({ id: 'ab-1' }), makeArtboard({ id: 'ab-2' })];

    renderWithProviders(
      <PanelMultiState
        selectedArtboards={artboards}
        onAddToEditor={onAddToEditor}
        onOpenInEditor={onOpenInEditor}
        onDeleteAll={onDeleteAll}
        onExportSelected={onExportSelected}
      />,
    );

    const addBtn = screen.getByLabelText(/Add to Editor/i);
    await user.click(addBtn);

    expect(onAddToEditor).toHaveBeenCalledTimes(1);
    expect(onAddToEditor).toHaveBeenCalledWith(['ab-1', 'ab-2']);
  });

  it('calls onOpenInEditor with selected artboard IDs when button clicked', async () => {
    const user = userEvent.setup();
    const artboards = [makeArtboard({ id: 'ab-3' })];

    renderWithProviders(
      <PanelMultiState
        selectedArtboards={artboards}
        onAddToEditor={onAddToEditor}
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
