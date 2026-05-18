// PROJ-34 Phase 13e — AccessoriesPicker unit tests.
// Multi-select Autocomplete with freeSolo over 6 fixed options. Persists as a
// `', '`-joined string on BuilderConfig.slots.accessories.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import AccessoriesPicker from '../AccessoriesPicker';
import { ACCESSORIES_OPTIONS } from '../../../constants/slotOptions';

const openPopup = () => {
  const input = screen.getByLabelText('Accessories selection');
  // ArrowDown on a focused Autocomplete input reliably opens the listbox.
  input.focus();
  fireEvent.keyDown(input, { key: 'ArrowDown', code: 'ArrowDown' });
  return input;
};

describe('AccessoriesPicker', () => {
  it('renders all 6 options in the dropdown listbox', () => {
    renderWithProviders(<AccessoriesPicker value="" onChange={vi.fn()} />);
    openPopup();
    const listbox = within(screen.getByRole('listbox'));
    for (const option of ACCESSORIES_OPTIONS) {
      expect(listbox.getByText(option)).toBeInTheDocument();
    }
  });

  it('calls onChange comma-joined when two presets are picked', () => {
    const onChange = vi.fn();
    // Start from one already-selected option; pick a second from the listbox
    // and assert the join.
    renderWithProviders(
      <AccessoriesPicker
        value={ACCESSORIES_OPTIONS[0]}
        onChange={onChange}
      />,
    );
    openPopup();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText(ACCESSORIES_OPTIONS[1]),
    );
    expect(onChange).toHaveBeenCalledWith(
      `${ACCESSORIES_OPTIONS[0]}, ${ACCESSORIES_OPTIONS[1]}`,
    );
  });

  it('renders the existing selections as chips', () => {
    const value = `${ACCESSORIES_OPTIONS[0]}, ${ACCESSORIES_OPTIONS[1]}`;
    renderWithProviders(
      <AccessoriesPicker value={value} onChange={vi.fn()} />,
    );
    expect(screen.getByText(ACCESSORIES_OPTIONS[0])).toBeInTheDocument();
    expect(screen.getByText(ACCESSORIES_OPTIONS[1])).toBeInTheDocument();
  });

  it('adds a free-typed custom entry on Enter (freeSolo)', () => {
    const onChange = vi.fn();
    renderWithProviders(<AccessoriesPicker value="" onChange={onChange} />);
    const input = screen.getByLabelText('Accessories selection');
    fireEvent.change(input, { target: { value: 'sparkle confetti' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('sparkle confetti');
  });
});
