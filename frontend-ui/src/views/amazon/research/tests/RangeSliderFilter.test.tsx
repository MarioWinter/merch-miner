import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import RangeSliderFilter from '../partials/RangeSliderFilter';

const baseProps = {
  label: 'BSR Range',
  value: [1, 500000] as [number, number],
  min: 1,
  max: 500000,
  step: 1000,
  enabled: true,
  onEnabledChange: vi.fn(),
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

  it('renders enable/disable toggle switch', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} />);

    expect(
      screen.getByLabelText('Enable BSR Range filter'),
    ).toBeInTheDocument();
  });

  it('toggle switch reflects enabled prop as checked', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} enabled={true} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
  });

  it('toggle switch reflects disabled state when enabled is false', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} enabled={false} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
  });

  it('calls onEnabledChange when toggle is clicked', async () => {
    const onEnabledChange = vi.fn();
    renderWithProviders(
      <RangeSliderFilter {...baseProps} enabled={false} onEnabledChange={onEnabledChange} />,
    );

    const toggle = screen.getByRole('switch');
    await userEvent.click(toggle);

    expect(onEnabledChange).toHaveBeenCalledWith(true);
  });

  it('displays formatted min and max values', () => {
    renderWithProviders(
      <RangeSliderFilter {...baseProps} value={[100, 50000]} />,
    );

    // Default formatValue uses toLocaleString()
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

  it('slider is disabled when enabled prop is false', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} enabled={false} />);

    const sliders = screen.getAllByRole('slider');
    // All slider thumbs should be disabled
    sliders.forEach((s) => {
      expect(s).toBeDisabled();
    });
  });

  it('slider is active when enabled prop is true', () => {
    renderWithProviders(<RangeSliderFilter {...baseProps} enabled={true} />);

    // MUI Slider renders two thumbs for a range slider
    const sliders = screen.getAllByRole('slider');
    expect(sliders.length).toBeGreaterThanOrEqual(1);
    sliders.forEach((s) => {
      expect(s).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('renders with different label correctly', () => {
    renderWithProviders(
      <RangeSliderFilter {...baseProps} label="Reviews" />,
    );

    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Enable Reviews filter'),
    ).toBeInTheDocument();
  });
});
