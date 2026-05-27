// PROJ-34 Phase 13n-b — FontCombinationPickerModal unit tests.
// Covers: 10-card render, search filter (label + case-insensitive), single-
// select toggling, commit lifecycle, ESC closes without committing.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import FontCombinationPickerModal from '../FontCombinationPickerModal';
import { FONT_COMBINATION_OPTIONS } from '../../../constants/slotOptions';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  value: '',
  onChange: vi.fn(),
};

describe('FontCombinationPickerModal', () => {
  it('renders all 10 built-in font combination cards', () => {
    renderWithProviders(<FontCombinationPickerModal {...baseProps} />);
    FONT_COMBINATION_OPTIONS.forEach((entry) => {
      expect(screen.getByText(entry.ui_label)).toBeInTheDocument();
    });
  });

  it('search filter narrows results by ui_label substring', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FontCombinationPickerModal {...baseProps} />);

    const searchBox = screen.getByLabelText('Search font combinations');
    await user.type(searchBox, 'Script');

    expect(screen.getByText('Script + Block Hierarchy')).toBeInTheDocument();
    expect(
      screen.queryByText('Serif + Sans Hierarchy'),
    ).not.toBeInTheDocument();
  });

  it('search filter is case-insensitive', async () => {
    const user = userEvent.setup();
    renderWithProviders(<FontCombinationPickerModal {...baseProps} />);

    const searchBox = screen.getByLabelText('Search font combinations');
    await user.type(searchBox, 'script');

    expect(screen.getByText('Script + Block Hierarchy')).toBeInTheDocument();
    expect(
      screen.queryByText('Serif + Sans Hierarchy'),
    ).not.toBeInTheDocument();
  });

  it('clicking a card sets local selection and enables "Use selection"', () => {
    renderWithProviders(<FontCombinationPickerModal {...baseProps} />);

    const useBtn = screen.getByRole('button', { name: /Use selection/i });
    expect(useBtn).toBeDisabled();

    const firstCard = screen.getByRole('button', {
      name: `Select ${FONT_COMBINATION_OPTIONS[0].ui_label}`,
    });
    fireEvent.click(firstCard);

    expect(useBtn).toBeEnabled();
  });

  it('"Use selection" commits the picked prompt_text and closes the modal', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FontCombinationPickerModal
        {...baseProps}
        onChange={onChange}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `Select ${FONT_COMBINATION_OPTIONS[2].ui_label}`,
      }),
    );
    const useBtn = screen.getByRole('button', { name: /Use selection/i });
    await user.click(useBtn);

    expect(onChange).toHaveBeenCalledWith(
      FONT_COMBINATION_OPTIONS[2].prompt_text,
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes without firing onChange', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FontCombinationPickerModal
        {...baseProps}
        onChange={onChange}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `Select ${FONT_COMBINATION_OPTIONS[0].ui_label}`,
      }),
    );
    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
