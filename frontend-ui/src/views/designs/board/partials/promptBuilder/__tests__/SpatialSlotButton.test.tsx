// PROJ-34 Phase 13e — SpatialSlotButton unit tests.
// Renders the currently-selected spatial as a tappable card. Three render
// variants: built-in id, custom UUID (CustomSpatial row), raw free-text.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import SpatialSlotButton from '../SpatialSlotButton';
import { SPATIAL_OPTIONS } from '../../../constants/slotOptions';

const BUILTIN = SPATIAL_OPTIONS[0]; // 'vertical_stack'

describe('SpatialSlotButton', () => {
  it('renders the built-in variant with thumbnail + ui_label', () => {
    renderWithProviders(
      <SpatialSlotButton value={BUILTIN.id} onOpenPicker={vi.fn()} />,
    );
    const card = screen.getByTestId('spatial-slot-button');
    expect(within(card).getByText(BUILTIN.ui_label)).toBeInTheDocument();
    const img = card.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain(BUILTIN.thumbnail_path);
  });

  it('renders the UUID variant ("Custom layout" + first 8 chars of id)', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-1234567890ab';
    renderWithProviders(
      <SpatialSlotButton value={uuid} onOpenPicker={vi.fn()} />,
    );
    const card = screen.getByTestId('spatial-slot-button');
    expect(within(card).getByText('Custom layout')).toBeInTheDocument();
    // "id " + first 8 chars
    expect(within(card).getByText('id a1b2c3d4')).toBeInTheDocument();
  });

  it('renders the raw-text variant ("Custom (typed)") for plain text', () => {
    renderWithProviders(
      <SpatialSlotButton
        value="a free-floating diagonal slash composition"
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('spatial-slot-button');
    expect(within(card).getByText('Custom (typed)')).toBeInTheDocument();
  });

  it('renders the empty placeholder when value is undefined', () => {
    renderWithProviders(
      <SpatialSlotButton value={undefined} onOpenPicker={vi.fn()} />,
    );
    const card = screen.getByTestId('spatial-slot-button');
    expect(
      within(card).getByText('Choose a spatial layout'),
    ).toBeInTheDocument();
  });

  it('renders the empty placeholder when value is an empty string', () => {
    renderWithProviders(
      <SpatialSlotButton value="" onOpenPicker={vi.fn()} />,
    );
    expect(screen.getByText('Choose a spatial layout')).toBeInTheDocument();
  });

  it('calls onOpenPicker when the card is clicked', () => {
    const onOpenPicker = vi.fn();
    renderWithProviders(
      <SpatialSlotButton
        value={BUILTIN.id}
        onOpenPicker={onOpenPicker}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Open picker/i }),
    );
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('renders the reset affordance and calls onReset when clicked', () => {
    const onReset = vi.fn();
    renderWithProviders(
      <SpatialSlotButton
        value={BUILTIN.id}
        onOpenPicker={vi.fn()}
        onReset={onReset}
      />,
    );
    const resetBtn = screen.getByRole('button', {
      name: /Reset spatial layout/i,
    });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
