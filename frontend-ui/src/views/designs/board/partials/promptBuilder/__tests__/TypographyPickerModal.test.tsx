// PROJ-34 Phase 13m-b — TypographyPickerModal unit tests.
// Covers: 22-card render, search filter (label + case-insensitive), single-
// select toggling, commit lifecycle, ESC closes without committing, auto-chip
// renders on the style-default card.

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
// PROJ-34 Phase 13t-m — Mock customTypographyApi so the picker can mount its
// new Custom / Create-new tabs without a real RTK Query middleware wired in.
vi.mock('@/services/customTypographyApi', () => ({
  customTypographyApi: {
    reducerPath: 'customTypographyApi',
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  },
  useListCustomTypographiesQuery: () => ({ data: [], isLoading: false }),
  useDeleteCustomTypographyMutation: () => [vi.fn(), { isLoading: false }],
  useAnalyzeTypographyMutation: () => [vi.fn(), { isLoading: false, error: undefined }],
  useCreateCustomTypographyMutation: () => [vi.fn(), { isLoading: false }],
}));

import { renderWithProviders } from '@/utils/test-utils';
import TypographyPickerModal from '../TypographyPickerModal';
import { TYPOGRAPHY_OPTIONS } from '../../../constants/slotOptions';

const baseProps = {
  open: true,
  onClose: vi.fn(),
  value: '',
  onChange: vi.fn(),
};

describe('TypographyPickerModal', () => {
  it('renders all 22 built-in typography cards', () => {
    renderWithProviders(<TypographyPickerModal {...baseProps} />);
    TYPOGRAPHY_OPTIONS.forEach((entry) => {
      expect(screen.getByText(entry.ui_label)).toBeInTheDocument();
    });
  });

  it('search filter narrows results by ui_label substring', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TypographyPickerModal {...baseProps} />);

    const searchBox = screen.getByLabelText('Search typography');
    await user.type(searchBox, 'Pixel');

    expect(screen.getByText('Pixel 8-bit Bitmap')).toBeInTheDocument();
    expect(
      screen.queryByText('Distressed Vintage Slab'),
    ).not.toBeInTheDocument();
  });

  it('search filter is case-insensitive', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TypographyPickerModal {...baseProps} />);

    const searchBox = screen.getByLabelText('Search typography');
    await user.type(searchBox, 'pixel');

    expect(screen.getByText('Pixel 8-bit Bitmap')).toBeInTheDocument();
    expect(
      screen.queryByText('Distressed Vintage Slab'),
    ).not.toBeInTheDocument();
  });

  it('clicking a card sets local selection and enables "Use selection"', () => {
    renderWithProviders(<TypographyPickerModal {...baseProps} />);

    const useBtn = screen.getByRole('button', { name: /Use selection/i });
    expect(useBtn).toBeDisabled();

    const firstCard = screen.getByRole('button', {
      name: `Select ${TYPOGRAPHY_OPTIONS[0].ui_label}`,
    });
    fireEvent.click(firstCard);

    expect(useBtn).toBeEnabled();
  });

  it('"Use selection" commits the picked prompt_text and closes the modal', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TypographyPickerModal
        {...baseProps}
        onChange={onChange}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `Select ${TYPOGRAPHY_OPTIONS[2].ui_label}`,
      }),
    );
    const useBtn = screen.getByRole('button', { name: /Use selection/i });
    await user.click(useBtn);

    expect(onChange).toHaveBeenCalledWith(TYPOGRAPHY_OPTIONS[2].prompt_text);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Cancel closes without firing onChange', async () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <TypographyPickerModal
        {...baseProps}
        onChange={onChange}
        onClose={onClose}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `Select ${TYPOGRAPHY_OPTIONS[0].ui_label}`,
      }),
    );
    await user.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders the auto-from-style chip on the card whose prompt_text matches styleDefault', () => {
    const styleDefaultEntry = TYPOGRAPHY_OPTIONS[3];
    renderWithProviders(
      <TypographyPickerModal
        {...baseProps}
        styleDefault={styleDefaultEntry.prompt_text}
        styleLabel="Varsity Sports"
      />,
    );

    const chips = screen.getAllByTestId('typography-modal-auto-chip');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent(/auto from Varsity Sports/i);
  });
});
