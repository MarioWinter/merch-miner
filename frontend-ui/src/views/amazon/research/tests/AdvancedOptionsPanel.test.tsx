import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';
import AdvancedOptionsPanel from '../partials/AdvancedOptionsPanel';
import { DEFAULT_FILTERS } from '../types';

const baseProps = {
  open: true,
  isLive: false,
  filters: { ...DEFAULT_FILTERS },
  onFilterChange: vi.fn(),
  onEnabledChange: vi.fn(),
};

describe('AdvancedOptionsPanel', () => {
  it('renders filter controls when open and in DB mode', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} />);

    expect(screen.getByText('BSR Range')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Price ($)')).toBeInTheDocument();
    expect(screen.getByText('Min. Rating')).toBeInTheDocument();
    expect(screen.getByText('Official Brands')).toBeInTheDocument();
    expect(screen.getByLabelText('Subcategory')).toBeInTheDocument();
    expect(screen.getByLabelText('Exclude Words (comma-separated)')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
  });

  it('Live mode dims DB-only filters but keeps Hide Official Brands active', () => {
    renderWithProviders(
      <AdvancedOptionsPanel {...baseProps} isLive={true} />,
    );

    // Hide Official Brands button should remain interactive
    const brandBtn = screen.getByRole('button', { name: 'Toggle hide official brands' });
    expect(brandBtn).toBeInTheDocument();
    expect(brandBtn).not.toBeDisabled();

    // BSR slider inputs should be dimmed (inside a container with pointerEvents none)
    const bsrSliders = screen.getAllByRole('slider');
    // All range sliders are inside dimmed containers
    bsrSliders.forEach((slider) => {
      const grid = slider.closest('.MuiGrid-root');
      if (grid) {
        const style = window.getComputedStyle(grid);
        expect(style.pointerEvents).toBe('none');
      }
    });
  });

  it('info banner shows in Live mode', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} isLive={true} />);

    expect(
      screen.getByText(/Hide Official Brands.*is active in Live mode/),
    ).toBeInTheDocument();
  });

  it('info banner does not show in DB mode', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} isLive={false} />);

    expect(
      screen.queryByText(/Hide Official Brands.*is active in Live mode/),
    ).not.toBeInTheDocument();
  });

  it('DB mode: all filters are interactive (not dimmed)', () => {
    const { container } = renderWithProviders(
      <AdvancedOptionsPanel {...baseProps} isLive={false} />,
    );

    const panelBox = container.querySelector('.MuiBox-root');
    const style = window.getComputedStyle(panelBox!);
    expect(style.opacity).not.toBe('0.4');
    expect(style.pointerEvents).not.toBe('none');
  });

  it('renders subcategory and exclude words text fields', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} />);

    const subcategory = screen.getByLabelText('Subcategory');
    const excludeWords = screen.getByLabelText('Exclude Words (comma-separated)');

    expect(subcategory).toBeInTheDocument();
    expect(excludeWords).toBeInTheDocument();
  });

  it('renders star rating filter with 5 star buttons', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} />);

    for (let i = 1; i <= 5; i++) {
      expect(
        screen.getByRole('button', { name: `Set minimum rating to ${i}` }),
      ).toBeInTheDocument();
    }
  });

  it('renders BSR, Reviews, and Price range slider filters (no enable toggles — always-on)', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} />);

    // The three range filters render their labels and sliders, but no Switch toggles.
    expect(screen.getByText('BSR Range')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();
    expect(screen.getByText('Price ($)')).toBeInTheDocument();
    // No filter-enable switches anywhere in the panel.
    expect(screen.queryByRole('switch')).toBeNull();
  });
});
