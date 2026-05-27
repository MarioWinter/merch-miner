// PROJ-34 Phase 13e — StyleSlotButton unit tests.
// Three variants: no selection, single-style selection, multi-style selection
// (first thumb + "+N more" suffix).

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import StyleSlotButton from '../StyleSlotButton';
import { STYLE_LIBRARY } from '../../../constants/styleLibrary';

const FIRST = STYLE_LIBRARY[0];
const SECOND = STYLE_LIBRARY[1];
const THIRD = STYLE_LIBRARY[2];

describe('StyleSlotButton', () => {
  it('renders "Choose styles" when nothing is selected', () => {
    renderWithProviders(
      <StyleSlotButton selectedSlugs={[]} onOpenPicker={vi.fn()} />,
    );
    const card = screen.getByTestId('style-slot-button');
    expect(within(card).getByText('Choose styles')).toBeInTheDocument();
    expect(
      within(card).getByText(/Pick one or more visual styles/i),
    ).toBeInTheDocument();
  });

  it('renders a single style label + thumbnail when one is selected', () => {
    renderWithProviders(
      <StyleSlotButton
        selectedSlugs={[FIRST.slug]}
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('style-slot-button');
    expect(within(card).getByText(FIRST.label)).toBeInTheDocument();
    expect(
      within(card).getByText(FIRST.shortDescription),
    ).toBeInTheDocument();
    const img = card.querySelector('img');
    expect(img?.getAttribute('src')).toBe(FIRST.thumbnail);
  });

  it('renders "label +N more" when two or more styles are selected', () => {
    renderWithProviders(
      <StyleSlotButton
        selectedSlugs={[FIRST.slug, SECOND.slug, THIRD.slug]}
        onOpenPicker={vi.fn()}
      />,
    );
    const card = screen.getByTestId('style-slot-button');
    expect(
      within(card).getByText(`${FIRST.label} +2 more`),
    ).toBeInTheDocument();
    expect(within(card).getByText(/3 styles selected/i)).toBeInTheDocument();
  });

  it('calls onOpenPicker when the card is clicked', () => {
    const onOpenPicker = vi.fn();
    renderWithProviders(
      <StyleSlotButton selectedSlugs={[]} onOpenPicker={onOpenPicker} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Open picker/i }));
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });
});
