import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../utils/test-utils';
import AdvancedOptionsPanel from '../partials/AdvancedOptionsPanel';
import { DEFAULT_FILTERS, DEFAULT_FILTER_ENABLED } from '../types';

const baseProps = {
  open: true,
  isLive: false,
  filters: { ...DEFAULT_FILTERS },
  enabled: { ...DEFAULT_FILTER_ENABLED },
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

  it('Live mode dims panel (opacity 0.4, pointer-events none)', () => {
    const { container } = renderWithProviders(
      <AdvancedOptionsPanel {...baseProps} isLive={true} />,
    );

    // The PanelBox is the first child inside Collapse's transition wrapper
    // It has the sx applied with opacity and pointerEvents
    const panelBox = container.querySelector('.MuiBox-root');
    expect(panelBox).toBeTruthy();

    const style = window.getComputedStyle(panelBox!);
    expect(style.opacity).toBe('0.4');
    expect(style.pointerEvents).toBe('none');
  });

  it('info banner shows in Live mode', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} isLive={true} />);

    expect(
      screen.getByText('Advanced filters available in DB Research mode only'),
    ).toBeInTheDocument();
  });

  it('info banner does not show in DB mode', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} isLive={false} />);

    expect(
      screen.queryByText('Advanced filters available in DB Research mode only'),
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

  it('renders BSR, Reviews, and Price range slider filters', () => {
    renderWithProviders(<AdvancedOptionsPanel {...baseProps} />);

    expect(screen.getByLabelText('Enable BSR Range filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Reviews filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Enable Price ($) filter')).toBeInTheDocument();
  });
});
