// PROJ-34 Phase 13e — MaterialPicker unit tests.
// Same affordance as TypographyPicker (Select + Custom… + auto-default chip +
// ↺ reset). MATERIAL_OPTIONS lives in slotOptions.ts.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import MaterialPicker from '../MaterialPicker';
import { MATERIAL_OPTIONS } from '../../../constants/slotOptions';

const DEFAULT = MATERIAL_OPTIONS[0];
const OTHER = MATERIAL_OPTIONS[1];

const openSelect = () =>
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: /Material option/i }),
  );

describe('MaterialPicker', () => {
  it('renders the "auto from style" chip when value === styleDefault', () => {
    renderWithProviders(
      <MaterialPicker
        value={DEFAULT}
        styleDefault={DEFAULT}
        styleLabel="Cartoon"
        onChange={vi.fn()}
      />,
    );
    const chip = screen.getByTestId('material-auto-chip');
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/auto from Cartoon/i);
  });

  it('renders the ↺ reset icon when value differs from styleDefault and resets to styleDefault on click', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <MaterialPicker
        value={OTHER}
        styleDefault={DEFAULT}
        styleLabel="Cartoon"
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Reset material/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT);
  });

  it('calls onChange with the selected preset', () => {
    const onChange = vi.fn();
    renderWithProviders(<MaterialPicker value="" onChange={onChange} />);
    openSelect();
    fireEvent.click(within(screen.getByRole('listbox')).getByText(DEFAULT));
    expect(onChange).toHaveBeenCalledWith(DEFAULT);
  });

  it('reveals a TextField when the user picks "Custom…"', () => {
    renderWithProviders(<MaterialPicker value="" onChange={vi.fn()} />);
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Custom…'),
    );
    expect(screen.getByLabelText('Custom material')).toBeInTheDocument();
  });
});
