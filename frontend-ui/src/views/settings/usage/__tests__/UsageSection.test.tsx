import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import UsageSection from '../UsageSection';

// Spy on just useGetQuotaQuery — keep the rest of upscaleApi intact so the
// store/index reducer wiring still loads.
vi.mock('@/store/upscaleApi', async (importActual) => {
  const actual = await importActual<typeof import('@/store/upscaleApi')>();
  return {
    ...actual,
    useGetQuotaQuery: vi.fn(),
  };
});

import { useGetQuotaQuery } from '@/store/upscaleApi';

const mockedQuery = useGetQuotaQuery as unknown as ReturnType<typeof vi.fn>;

describe('UsageSection', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('renders skeleton while loading', () => {
    mockedQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<UsageSection />);
    // Two skeleton lines rendered (text width 200 + 140) — at least one visible.
    expect(document.querySelectorAll('[class*="MuiSkeleton-root"]').length).toBeGreaterThan(0);
  });

  it('renders error fallback when the query errors', () => {
    mockedQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<UsageSection />);
    expect(screen.getByText(/could not load usage/i)).toBeInTheDocument();
  });

  it('renders Unlimited badge for staff (is_unlimited=true)', () => {
    mockedQuery.mockReturnValue({
      data: {
        used: 0,
        limit: null,
        resets_on: '2026-06-01',
        is_unlimited: true,
      },
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<UsageSection />);
    expect(screen.getByText(/unlimited/i)).toBeInTheDocument();
    // No progress ring text in unlimited mode.
    expect(screen.queryByText('87/100')).not.toBeInTheDocument();
  });

  it('renders progress ring with used/limit for non-staff', () => {
    mockedQuery.mockReturnValue({
      data: {
        used: 42,
        limit: 100,
        resets_on: '2026-06-01',
        is_unlimited: false,
      },
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<UsageSection />);
    expect(screen.getByText('42/100')).toBeInTheDocument();
    expect(screen.getByText(/resets on 2026-06-01/i)).toBeInTheDocument();
  });

  it('shows the section title', () => {
    mockedQuery.mockReturnValue({
      data: { used: 0, limit: 100, resets_on: '2026-06-01', is_unlimited: false },
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<UsageSection />);
    expect(screen.getByText(/^Usage$/i)).toBeInTheDocument();
  });
});
