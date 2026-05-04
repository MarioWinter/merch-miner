import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../../utils/test-utils';
import ControlsRow from '../partials/ControlsRow';
import {
  DEFAULT_FILTERS,
  LIVE_SORT_OPTIONS,
  SORT_OPTIONS,
  PRODUCT_TYPE_OPTIONS,
} from '../types';

const defaultProps = {
  isLive: false,
  filters: { ...DEFAULT_FILTERS },
  onFilterChange: vi.fn(),
  advancedOpen: false,
  onToggleAdvanced: vi.fn(),
  activeFilterCount: 0,
};

describe('ControlsRow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders marketplace, product type, and sort dropdowns', () => {
    renderWithProviders(<ControlsRow {...defaultProps} />);
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBe(3);
  });

  it('shows DB sort options in DB mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlsRow {...defaultProps} isLive={false} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[2]);

    const listbox = screen.getByRole('listbox');
    for (const opt of SORT_OPTIONS) {
      expect(within(listbox).getByText(opt.label)).toBeInTheDocument();
    }
  });

  it('shows Live sort options in Live mode', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlsRow {...defaultProps} isLive={true} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[2]);

    const listbox = screen.getByRole('listbox');
    for (const opt of LIVE_SORT_OPTIONS) {
      expect(within(listbox).getByText(opt.label)).toBeInTheDocument();
    }
  });

  it('calls onFilterChange with live_sort_by when live sort is changed', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ControlsRow {...defaultProps} isLive={true} onFilterChange={onFilterChange} />,
    );

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[2]);

    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByText('Best Sellers'));

    expect(onFilterChange).toHaveBeenCalledWith(
      'live_sort_by',
      'exact-aware-popularity-rank',
    );
  });

  it('calls onFilterChange with sort_by when DB sort is changed', async () => {
    const onFilterChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <ControlsRow {...defaultProps} isLive={false} onFilterChange={onFilterChange} />,
    );

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[2]);

    const listbox = screen.getByRole('listbox');
    await user.click(within(listbox).getByText('Newest First'));

    expect(onFilterChange).toHaveBeenCalledWith('sort_by', 'newest');
  });

  it('renders all 16 product types in dropdown', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ControlsRow {...defaultProps} />);

    const comboboxes = screen.getAllByRole('combobox');
    await user.click(comboboxes[1]);

    const listbox = screen.getByRole('listbox');
    for (const opt of PRODUCT_TYPE_OPTIONS) {
      expect(within(listbox).getByText(opt.label)).toBeInTheDocument();
    }
    expect(PRODUCT_TYPE_OPTIONS).toHaveLength(16);
  });

  it('does not render live filter inputs in live mode (removed)', () => {
    renderWithProviders(<ControlsRow {...defaultProps} isLive={true} />);
    expect(screen.queryByLabelText('Minimum price filter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Maximum price filter')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Number of pages to scrape')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Browse node override')).not.toBeInTheDocument();
  });

  it('shows product type label in closed select', () => {
    renderWithProviders(
      <ControlsRow {...defaultProps} filters={{ ...DEFAULT_FILTERS, product_type: 't_shirt' }} />,
    );
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes[1]).toHaveTextContent('T-Shirt');
  });

  it('shows advanced options button with filter count', () => {
    renderWithProviders(<ControlsRow {...defaultProps} activeFilterCount={3} />);
    expect(screen.getByText('Advanced Options (3)')).toBeInTheDocument();
  });

  it('sort dropdown visible in both Live and DB modes', () => {
    const { unmount } = renderWithProviders(
      <ControlsRow {...defaultProps} isLive={false} />,
    );
    expect(screen.getAllByRole('combobox').length).toBe(3);
    unmount();

    renderWithProviders(
      <ControlsRow {...defaultProps} isLive={true} />,
    );
    expect(screen.getAllByRole('combobox').length).toBe(3);
  });
});
