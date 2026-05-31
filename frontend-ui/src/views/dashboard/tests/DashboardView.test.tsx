import { screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '../../../utils/test-utils';
import DashboardView from '../DashboardView';
import type { DashboardData } from '../types';

// Mock the RTK Query hooks
const mockDashboard: DashboardData = {
  niche_counts: { research: 5, design: 3, publish: 2, live: 10, done: 4, archived: 1 },
  design_counts: { total: 45, approved: 12 },
  listing_counts: { total: 12, ready: 8 },
  recent_activity: [
    { event: 'niche_created', niche_name: 'Camping Dad', user: 'Mario', agent_type: null, timestamp: new Date().toISOString() },
    { event: 'design_generated', niche_name: 'Nurse Humor', user: '', agent_type: 'design', timestamp: new Date().toISOString() },
  ],
  stuck_niches: [
    { id: '1', name: 'Old Niche', status: 'researched', days_stuck: 9 },
  ],
  agent_activity: {
    active_workflows: 2,
    budget_usage_percent: 65,
    last_completed: { niche: 'Camping', template: 'full_pipeline', duration_minutes: 12 },
    recent_actions: [],
    success_rate: 0.87,
    per_agent_stats: { research: { runs: 12, cost: 2.40 }, design: { runs: 8, cost: 5.60 } },
  },
  search_activity: {
    searches_this_week: [{ day: '2026-03-24', count: 8 }],
    top_queries: ['camping trends', 'nurse humor'],
    crawl_count: 15,
    crawl_success_rate: 0.93,
  },
};

vi.mock('../../../store/dashboardSlice', () => ({
  useGetDashboardQuery: vi.fn(),
  useGetDesignAnalyticsQuery: vi.fn(),
  useGetListingAnalyticsQuery: vi.fn(),
  useGetAgentAnalyticsQuery: vi.fn(),
  useGetSearchAnalyticsQuery: vi.fn(),
  // FIX-dashboard Phase 7b: mounted RoadmapWidget calls useGetRoadmapQuery
  // through useRoadmap. Stub the hook so the DashboardView test renders
  // the widget in its empty-state branch without hitting the network.
  useGetRoadmapQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
  // FIX-dashboard Phase 8b: mounted ChangelogWidget calls useGetChangelogQuery
  // through useChangelog. Stub the hook so DashboardView renders the widget
  // in its empty-state branch without hitting the network.
  useGetChangelogQuery: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
  })),
  dashboardApi: {
    reducerPath: 'dashboardApi',
    reducer: (state = {}) => state,
    middleware: () => (next: (action: unknown) => unknown) => (action: unknown) => next(action),
  },
}));

// Import AFTER mock so we get the mocked module
import {
  useGetDashboardQuery,
  useGetDesignAnalyticsQuery,
  useGetListingAnalyticsQuery,
  useGetAgentAnalyticsQuery,
  useGetSearchAnalyticsQuery,
} from '../../../store/dashboardSlice';

const mockedDashboardQuery = vi.mocked(useGetDashboardQuery);
const mockedDesignQuery = vi.mocked(useGetDesignAnalyticsQuery);
const mockedListingQuery = vi.mocked(useGetListingAnalyticsQuery);
const mockedAgentQuery = vi.mocked(useGetAgentAnalyticsQuery);
const mockedSearchQuery = vi.mocked(useGetSearchAnalyticsQuery);

const defaultQueryReturn = {
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  isSuccess: true,
  error: undefined,
  refetch: vi.fn(),
  isUninitialized: false,
  currentData: undefined,
  fulfilledTimeStamp: 0,
  startedTimeStamp: 0,
  requestId: '',
  endpointName: '',
  originalArgs: undefined,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockedDesignQuery.mockReturnValue({ ...defaultQueryReturn, data: [] });
  mockedListingQuery.mockReturnValue({ ...defaultQueryReturn, data: [] });
  mockedAgentQuery.mockReturnValue({ ...defaultQueryReturn, data: undefined });
  mockedSearchQuery.mockReturnValue({ ...defaultQueryReturn, data: undefined });
});

describe('DashboardView', () => {
  it('renders loading skeletons while fetching', () => {
    mockedDashboardQuery.mockReturnValue({
      ...defaultQueryReturn,
      isLoading: true,
      data: undefined,
    });

    renderWithProviders(<DashboardView />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders KPI values when data is loaded', async () => {
    mockedDashboardQuery.mockReturnValue({
      ...defaultQueryReturn,
      data: mockDashboard,
    });

    renderWithProviders(<DashboardView />);

    // KPI labels should be present (some appear in both KPI and funnel)
    await waitFor(() => {
      expect(screen.getAllByText('Research').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Live').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Designs Approved')).toBeInTheDocument();
      expect(screen.getByText('Listings Ready')).toBeInTheDocument();
    });
  });

  it('renders activity feed events', async () => {
    mockedDashboardQuery.mockReturnValue({
      ...defaultQueryReturn,
      data: mockDashboard,
    });

    renderWithProviders(<DashboardView />);

    await waitFor(() => {
      expect(screen.getByText(/Camping Dad/)).toBeInTheDocument();
      expect(screen.getByText(/Nurse Humor/)).toBeInTheDocument();
    });
  });

  it('renders stuck niches widget', async () => {
    mockedDashboardQuery.mockReturnValue({
      ...defaultQueryReturn,
      data: mockDashboard,
    });

    renderWithProviders(<DashboardView />);

    await waitFor(() => {
      expect(screen.getByText('Old Niche')).toBeInTheDocument();
      expect(screen.getByText('9d stuck')).toBeInTheDocument();
    });
  });

  it('shows error alert on fetch failure', () => {
    mockedDashboardQuery.mockReturnValue({
      ...defaultQueryReturn,
      error: { status: 500, data: 'Server error' },
    });

    renderWithProviders(<DashboardView />);
    expect(screen.getByText('Failed to load dashboard data')).toBeInTheDocument();
  });

  it('shows empty state when no activity', async () => {
    const emptyDashboard: DashboardData = {
      niche_counts: { research: 0, design: 0, publish: 0, live: 0, done: 0, archived: 0 },
      design_counts: { total: 0, approved: 0 },
      listing_counts: { total: 0, ready: 0 },
      recent_activity: [],
      stuck_niches: [],
      agent_activity: { configured: false, message: 'Agent not set up', active_workflows: 0, budget_usage_percent: 0, last_completed: null, recent_actions: [], success_rate: 0, per_agent_stats: {} },
      search_activity: { configured: false, message: 'Search not connected', searches_this_week: [], top_queries: [], crawl_count: 0, crawl_success_rate: 0 },
    };

    mockedDashboardQuery.mockReturnValue({
      ...defaultQueryReturn,
      data: emptyDashboard,
    });

    renderWithProviders(<DashboardView />);

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
      expect(screen.getByText('No stuck niches')).toBeInTheDocument();
      expect(screen.getByText('Agent not set up')).toBeInTheDocument();
      expect(screen.getByText('Search not connected')).toBeInTheDocument();
    });
  });
});
