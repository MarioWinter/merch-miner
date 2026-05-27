// PROJ-34 Phase 13n-b — FontCombinationSlotButton unit tests.
// Card-style affordance with three render variants (empty · built-in · raw
// custom) plus the ↺ reset button.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import FontCombinationSlotButton from '../FontCombinationSlotButton';
import { FONT_COMBINATION_OPTIONS } from '../../../constants/slotOptions';

const FIRST = FONT_COMBINATION_OPTIONS[0];

describe('FontCombinationSlotButton', () => {
  it('renders the empty placeholder when value is an empty string', () => {
    renderWithProviders(
      <FontCombinationSlotButton value="" onOpenPicker={vi.fn()} />,
    );
    expect(screen.getByText('Choose font combination')).toBeInTheDocument();
  });

  it('renders the built-in variant with thumbnail + ui_label', () => {
    renderWithProviders(
      <FontCombinationSlotButton
        value={FIRST.prompt_text}
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('font-combination-slot-button');
    expect(within(card).getByText(FIRST.ui_label)).toBeInTheDocument();
    const img = card.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain(FIRST.thumbnail_path);
  });

  it('renders the "Custom combination" variant for raw free-text', () => {
    renderWithProviders(
      <FontCombinationSlotButton
        value="a bespoke serif headline plus a flowing script accent"
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('font-combination-slot-button');
    expect(within(card).getByText('Custom combination')).toBeInTheDocument();
    // Subtitle length here is < 60 chars so the text is visible verbatim.
    expect(
      within(card).getByText(/bespoke serif headline plus a flowing script/i),
    ).toBeInTheDocument();
  });

  it('clicking the card fires onOpenPicker', () => {
    const onOpenPicker = vi.fn();
    renderWithProviders(
      <FontCombinationSlotButton
        value={FIRST.prompt_text}
        onOpenPicker={onOpenPicker}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Open picker/i }));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('renders the ↺ reset button when value is non-empty and fires onReset (not onOpenPicker)', () => {
    const onReset = vi.fn();
    const onOpenPicker = vi.fn();
    renderWithProviders(
      <FontCombinationSlotButton
        value={FIRST.prompt_text}
        onOpenPicker={onOpenPicker}
        onReset={onReset}
      />,
    );
    const resetBtn = screen.getByRole('button', {
      name: /Reset font combination/i,
    });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onOpenPicker).not.toHaveBeenCalled();
  });

  it('does not render the ↺ reset button when value is empty', () => {
    renderWithProviders(
      <FontCombinationSlotButton
        value=""
        onOpenPicker={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Reset font combination/i }),
    ).not.toBeInTheDocument();
  });
});
