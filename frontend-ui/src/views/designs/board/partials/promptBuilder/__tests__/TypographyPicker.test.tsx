// PROJ-34 Phase 13e — TypographyPicker unit tests.
// MUI Select over 6 preset options + Custom… reveal + style-auto-default Chip
// + ↺ reset to the style-default.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import TypographyPicker from '../TypographyPicker';
import { TYPOGRAPHY_OPTIONS } from '../../../constants/slotOptions';

const DEFAULT = TYPOGRAPHY_OPTIONS[0];
const OTHER = TYPOGRAPHY_OPTIONS[1];

const openSelect = () =>
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: /Typography option/i }),
  );

describe('TypographyPicker', () => {
  it('renders the "auto from style" chip when value === styleDefault', () => {
    renderWithProviders(
      <TypographyPicker
        value={DEFAULT}
        styleDefault={DEFAULT}
        styleLabel="Vintage Retro"
        onChange={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('typography-auto-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/auto from Vintage Retro/i);
  });

  it('hides the "auto from style" chip when value !== styleDefault', () => {
    renderWithProviders(
      <TypographyPicker
        value={OTHER}
        styleDefault={DEFAULT}
        styleLabel="Vintage Retro"
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('typography-auto-chip'),
    ).not.toBeInTheDocument();
  });

  it('renders the ↺ reset icon when value differs from styleDefault and calls onChange(styleDefault) on click', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TypographyPicker
        value={OTHER}
        styleDefault={DEFAULT}
        styleLabel="Vintage Retro"
        onChange={onChange}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Reset typography/i }),
    );
    expect(onChange).toHaveBeenCalledWith(DEFAULT);
  });

  it('calls onChange with the picked preset when an option is selected', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TypographyPicker value="" onChange={onChange} />,
    );
    openSelect();
    fireEvent.click(within(screen.getByRole('listbox')).getByText(DEFAULT));
    expect(onChange).toHaveBeenCalledWith(DEFAULT);
  });

  it('reveals a TextField when the user picks "Custom…"', () => {
    renderWithProviders(<TypographyPicker value="" onChange={vi.fn()} />);
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Custom…'),
    );
    expect(screen.getByLabelText('Custom typography')).toBeInTheDocument();
  });
});
