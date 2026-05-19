// PROJ-34 Phase 13l — FontCombinationPicker unit tests.
// MUI Select over 8 multi-font preset options + Custom… reveal + ↺ reset.
// Unlike TypographyPicker, there's no styleDefault — the helper text
// explains the typography override behavior.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import FontCombinationPicker from '../FontCombinationPicker';
import { FONT_COMBINATION_OPTIONS } from '../../../constants/slotOptions';

const FIRST = FONT_COMBINATION_OPTIONS[0].prompt_text;

const openSelect = () =>
  fireEvent.mouseDown(
    screen.getByRole('combobox', { name: /Font combination option/i }),
  );

describe('FontCombinationPicker', () => {
  it('renders all 8 preset options + None + Custom… in the listbox', () => {
    renderWithProviders(<FontCombinationPicker value="" onChange={vi.fn()} />);
    openSelect();
    const listbox = screen.getByRole('listbox');
    // 8 presets + "None — single font" + "Custom…" = 10 menu items
    expect(within(listbox).getAllByRole('option')).toHaveLength(10);
    expect(within(listbox).getByText('None — single font')).toBeInTheDocument();
    expect(within(listbox).getByText('Custom…')).toBeInTheDocument();
    FONT_COMBINATION_OPTIONS.forEach((opt) => {
      expect(within(listbox).getByText(opt.ui_label)).toBeInTheDocument();
    });
  });

  it('calls onChange with prompt_text (not id or label) when a preset is picked', () => {
    const onChange = vi.fn();
    renderWithProviders(<FontCombinationPicker value="" onChange={onChange} />);
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText(
        FONT_COMBINATION_OPTIONS[0].ui_label,
      ),
    );
    expect(onChange).toHaveBeenCalledWith(FIRST);
    expect(onChange).not.toHaveBeenCalledWith(FONT_COMBINATION_OPTIONS[0].id);
    expect(onChange).not.toHaveBeenCalledWith(
      FONT_COMBINATION_OPTIONS[0].ui_label,
    );
  });

  it('reveals a multiline TextField with the expected placeholder when "Custom…" is picked', () => {
    renderWithProviders(<FontCombinationPicker value="" onChange={vi.fn()} />);
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Custom…'),
    );
    const customField = screen.getByLabelText('Custom font combination');
    expect(customField).toBeInTheDocument();
    expect(customField).toHaveAttribute(
      'placeholder',
      'Describe the font combination — e.g. headline serif + script accent + small sans subtitle',
    );
  });

  it('fires onChange with raw text when the user types into the Custom TextField', () => {
    const onChange = vi.fn();
    renderWithProviders(<FontCombinationPicker value="" onChange={onChange} />);
    openSelect();
    fireEvent.click(
      within(screen.getByRole('listbox')).getByText('Custom…'),
    );
    const customField = screen.getByLabelText('Custom font combination');
    fireEvent.change(customField, { target: { value: 'my custom combo' } });
    expect(onChange).toHaveBeenCalledWith('my custom combo');
  });

  it('renders the ↺ reset button when value is non-empty and clears the slot on click', () => {
    const onChange = vi.fn();
    renderWithProviders(
      <FontCombinationPicker value={FIRST} onChange={onChange} />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /Reset font combination/i }),
    );
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows helper text describing the typography override behavior', () => {
    renderWithProviders(<FontCombinationPicker value="" onChange={vi.fn()} />);
    expect(
      screen.getByText(
        /Sets a multi-font hierarchy\. Replaces the single-font Typography selection\./i,
      ),
    ).toBeInTheDocument();
  });
});
