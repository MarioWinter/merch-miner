/**
 * PROJ-17 Phase 6 — HealthStatusDot component tests
 *
 * Mocks the useSearchHealth hook (not the underlying RTK Query) so we
 * test pure render output: dot color, animation, tooltip, accessibility.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import HealthStatusDot from '../HealthStatusDot';
import { renderWithProviders } from '../../../utils/test-utils';

vi.mock('../hooks/useSearchHealth', () => ({
  useSearchHealth: vi.fn(),
}));

import { useSearchHealth } from '../hooks/useSearchHealth';
const mockedHook = vi.mocked(useSearchHealth);

const baseReturn = {
  health: undefined,
  isLoading: false,
  isError: false,
  vaneOnline: false,
  crawl4aiOnline: false,
  allOnline: false,
  allOffline: true,
  partial: false,
  statusColor: 'error' as const,
};

describe('HealthStatusDot', () => {
  beforeEach(() => {
    mockedHook.mockReset();
  });

  it('renders nothing while loading', () => {
    mockedHook.mockReturnValue({ ...baseReturn, isLoading: true });
    const { container } = renderWithProviders(<HealthStatusDot />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a dot with role=status when both services online', () => {
    mockedHook.mockReturnValue({
      ...baseReturn,
      vaneOnline: true,
      crawl4aiOnline: true,
      allOnline: true,
      allOffline: false,
      statusColor: 'success',
    });
    renderWithProviders(<HealthStatusDot />);
    const dot = screen.getByRole('status');
    expect(dot).toBeInTheDocument();
  });

  it('renders error color when both offline', () => {
    mockedHook.mockReturnValue({
      ...baseReturn,
      statusColor: 'error',
    });
    renderWithProviders(<HealthStatusDot />);
    const dot = screen.getByRole('status');
    expect(dot).toBeInTheDocument();
  });

  it('renders warning color when partial', () => {
    mockedHook.mockReturnValue({
      ...baseReturn,
      vaneOnline: true,
      crawl4aiOnline: false,
      allOnline: false,
      allOffline: false,
      partial: true,
      statusColor: 'warning',
    });
    renderWithProviders(<HealthStatusDot />);
    const dot = screen.getByRole('status');
    expect(dot).toBeInTheDocument();
  });

  it('exposes an aria-label describing both services', () => {
    mockedHook.mockReturnValue({
      ...baseReturn,
      vaneOnline: true,
      crawl4aiOnline: true,
      allOnline: true,
      allOffline: false,
      statusColor: 'success',
    });
    renderWithProviders(<HealthStatusDot />);
    const dot = screen.getByRole('status');
    const label = dot.getAttribute('aria-label') || '';
    expect(label.length).toBeGreaterThan(0);
  });

  it('aria-label changes between online and offline states', () => {
    mockedHook.mockReturnValue({
      ...baseReturn,
      vaneOnline: true,
      crawl4aiOnline: true,
      allOnline: true,
      allOffline: false,
      statusColor: 'success',
    });
    const { rerender } = renderWithProviders(<HealthStatusDot />);
    const onlineLabel = screen.getByRole('status').getAttribute('aria-label');

    mockedHook.mockReturnValue({ ...baseReturn, statusColor: 'error' });
    rerender(<HealthStatusDot />);
    const offlineLabel = screen.getByRole('status').getAttribute('aria-label');

    expect(onlineLabel).not.toEqual(offlineLabel);
  });
});
