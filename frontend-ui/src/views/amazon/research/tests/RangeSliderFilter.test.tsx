import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';
import RangeSliderFilter from '../partials/RangeSliderFilter';

const baseProps = {
  label: 'BSR Range',
  value: [1, 500000] as [number, number],
  min: 1,
  max: 500000,
  step: 1000,
  onChange: vi.fn(),
};

describe('RangeSliderFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders label text', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} />);
    expect(screen.getByText('BSR Range')).toBeInTheDocument();
  });

  it('does not render an enable/disable toggle switch (filter is always-on)', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('displays formatted min and max values', () => {
    renderWithProviders(
      <RangeSliderFilter {...baseProps} value={[100, 50000]} />,
    );
    expect(screen.getByText('100 - 50,000')).toBeInTheDocument();
  });

  it('uses custom formatValue when provided', () => {
    renderWithProviders(
      <RangeSliderFilter
        {...baseProps}
        label="Price ($)"
        value={[5, 80]}
        min={1}
        max={100}
        step={1}
        formatValue={(v) => `$${v}`}
      />,
    );
    expect(screen.getByText('$5 - $80')).toBeInTheDocument();
  });

  it('slider is interactive (always-on)', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} />);
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(1);
    sliders.forEach((s) => {
      expect(s).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('renders with different label correctly', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} label="Reviews" />);
    expect(screen.getByText('Reviews')).toBeInTheDocument();
  });
});
