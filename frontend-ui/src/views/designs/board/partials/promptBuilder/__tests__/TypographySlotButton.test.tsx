// PROJ-34 Phase 13m-b — TypographySlotButton unit tests.
// Card-style affordance with three render variants (empty · built-in · raw
// custom) plus the style-default auto-chip and the ↺ reset button.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import TypographySlotButton from '../TypographySlotButton';
import { TYPOGRAPHY_OPTIONS } from '../../../constants/slotOptions';

const FIRST = TYPOGRAPHY_OPTIONS[0];
const SECOND = TYPOGRAPHY_OPTIONS[1];

describe('TypographySlotButton', () => {
  it('renders the empty placeholder when value is an empty string', () => {
    renderWithProviders(
      <TypographySlotButton value="" onOpenPicker={vi.fn()} />,
    );
    expect(screen.getByText('Choose typography')).toBeInTheDocument();
  });

  it('renders the built-in variant with thumbnail + ui_label', () => {
    renderWithProviders(
      <TypographySlotButton
        value={FIRST.prompt_text}
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('typography-slot-button');
    expect(within(card).getByText(FIRST.ui_label)).toBeInTheDocument();
    const img = card.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toContain(FIRST.thumbnail_path);
  });

  it('renders the "Custom typography" variant for raw free-text', () => {
    renderWithProviders(
      <TypographySlotButton
        value="a chunky wooden hand-carved sign typography"
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('typography-slot-button');
    expect(within(card).getByText('Custom typography')).toBeInTheDocument();
    // Subtitle truncated to ≤60 chars — text length here is < 60 so visible verbatim.
    expect(
      within(card).getByText(/chunky wooden hand-carved sign/i),
    ).toBeInTheDocument();
  });

  it('renders the "auto from {style}" chip when value === styleDefault', () => {
    renderWithProviders(
      <TypographySlotButton
        value={FIRST.prompt_text}
        styleDefault={FIRST.prompt_text}
        styleLabel="Vintage Retro"
        onOpenPicker={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('typography-slot-auto-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/auto from Vintage Retro/i);
  });

  it('hides the auto chip when value !== styleDefault', () => {
    renderWithProviders(
      <TypographySlotButton
        value={SECOND.prompt_text}
        styleDefault={FIRST.prompt_text}
        styleLabel="Vintage Retro"
        onOpenPicker={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('typography-slot-auto-chip'),
    ).not.toBeInTheDocument();
  });

  it('clicking the card fires onOpenPicker', () => {
    const onOpenPicker = vi.fn();
    renderWithProviders(
      <TypographySlotButton
        value={FIRST.prompt_text}
        onOpenPicker={onOpenPicker}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Open picker/i }));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });

  it('renders the ↺ reset button when value !== styleDefault and fires onReset (not onOpenPicker)', () => {
    const onReset = vi.fn();
    const onOpenPicker = vi.fn();
    renderWithProviders(
      <TypographySlotButton
        value={SECOND.prompt_text}
        styleDefault={FIRST.prompt_text}
        styleLabel="Vintage Retro"
        onOpenPicker={onOpenPicker}
        onReset={onReset}
      />,
    );
    const resetBtn = screen.getByRole('button', {
      name: /Reset typography/i,
    });
    fireEvent.click(resetBtn);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onOpenPicker).not.toHaveBeenCalled();
  });

  it('does not render the ↺ reset button when value === styleDefault', () => {
    renderWithProviders(
      <TypographySlotButton
        value={FIRST.prompt_text}
        styleDefault={FIRST.prompt_text}
        styleLabel="Vintage Retro"
        onOpenPicker={vi.fn()}
        onReset={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Reset typography/i }),
    ).not.toBeInTheDocument();
  });
});
