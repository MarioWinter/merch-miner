// PROJ-34 Phase 13e — TextSegmentationPicker unit tests.
// MUI Select over 6 fixed options + "Custom…" reveal. No style-auto-default
// for this slot (`styleDefault` is accepted for prop-shape symmetry but never
// renders the chip).

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import TextSegmentationPicker from '../TextSegmentationPicker';
import { TEXT_SEGMENTATION_OPTIONS } from '../../../constants/slotOptions';

const openSelect = () =>
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: /Text segmentation option/i }),
  );

describe('TextSegmentationPicker', () => {
  it('renders all 6 preset options inside the dropdown', () => {
    renderWithProviders(
      <TextSegmentationPicker value="" onChange={vi.fn()} />,
    );
    openSelect();
    const listbox = within(screen.getByRole('listbox'));
    for (const option of TEXT_SEGMENTATION_OPTIONS) {
      expect(listbox.getByText(option)).toBeInTheDocument();
    }
  });

  it('calls onChange with the preset text when an option is selected', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TextSegmentationPicker value="" onChange={onChange} />,
    );
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText(
        TEXT_SEGMENTATION_OPTIONS[0],
      ),
    );
    expect(onChange).toHaveBeenCalledWith(TEXT_SEGMENTATION_OPTIONS[0]);
  });

  it('reveals a TextField when the user selects "Custom…"', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TextSegmentationPicker value="" onChange={onChange} />,
    );
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Custom…'),
    );
    expect(
      screen.getByLabelText('Custom text segmentation'),
    ).toBeInTheDocument();
  });

  it('fires onChange when the user types in the Custom TextField', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TextSegmentationPicker
        value="my custom segmentation rule"
        onChange={onChange}
      />,
    );
    const input = screen.getByLabelText('Custom text segmentation');
    fireEvent.change(input, {
      target: { value: 'two short hard-stopped phrases on separate lines' },
    });
    expect(onChange).toHaveBeenCalledWith(
      'two short hard-stopped phrases on separate lines',
    );
  });

  it('does not render the auto-from-style chip even when styleDefault matches', () => {
    // This slot intentionally ignores style-auto-default (Appendix J.3 row 3:
    // style_auto_default: False) — chip must never appear.
    renderWithProviders(
      <TextSegmentationPicker
        value={TEXT_SEGMENTATION_OPTIONS[0]}
        styleDefault={TEXT_SEGMENTATION_OPTIONS[0]}
        onChange={vi.fn()}
      />,
    );
    expect(
      screen.queryByTestId('typography-auto-chip'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('material-auto-chip'),
    ).not.toBeInTheDocument();
  });
});
