import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type {
  DashboardData,
  DesignAnalyticsItem,
  ListingAnalyticsItem,
  AgentAnalyticsData,
  SearchAnalyticsData,
  DateRange,
} from '../views/dashboard/types';

export interface RoadmapItem {
  title: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
}

export interface RoadmapResponse {
  items: RoadmapItem[];
  last_updated: string | null;
}

export interface ChangelogVersion {
  version: string;
  date: string;
  items: string[];
}

export interface ChangelogResponse {
  versions: ChangelogVersion[];
}

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Dashboard', 'DesignAnalytics', 'ListingAnalytics', 'AgentAnalytics', 'SearchAnalytics', 'Roadmap', 'Changelog'],
  endpoints: (builder) => ({
    getDashboard: builder.query<DashboardData, void>({
      query: () => ({
        url: '/api/dashboard/',
        method: 'GET',
      }),
      providesTags: ['Dashboard'],
    }),

    getDesignAnalytics: builder.query<DesignAnalyticsItem[], DateRange | void>({
      query: (params) => ({
        url: '/api/dashboard/analytics/designs/',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['DesignAnalytics'],
    }),

    getListingAnalytics: builder.query<ListingAnalyticsItem[], DateRange | void>({
      query: (params) => ({
        url: '/api/dashboard/analytics/listings/',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['ListingAnalytics'],
    }),

    getAgentAnalytics: builder.query<AgentAnalyticsData, DateRange | void>({
      query: (params) => ({
        url: '/api/dashboard/analytics/agent/',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['AgentAnalytics'],
    }),

    getSearchAnalytics: builder.query<SearchAnalyticsData, DateRange | void>({
      query: (params) => ({
        url: '/api/dashboard/analytics/search/',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['SearchAnalytics'],
    }),

    getRoadmap: builder.query<RoadmapResponse, { lang?: 'de' | 'en' } | void>({
      query: (arg) => ({
        url: '/api/dashboard/roadmap/',
        method: 'GET',
        params: arg?.lang ? { lang: arg.lang } : undefined,
      }),
      providesTags: ['Roadmap'],
    }),

    getChangelog: builder.query<ChangelogResponse, { lang?: 'de' | 'en' } | void>({
      query: (arg) => ({
        url: '/api/dashboard/changelog/',
        method: 'GET',
        params: arg?.lang ? { lang: arg.lang } : undefined,
      }),
      providesTags: ['Changelog'],
    }),
  }),
});

export const {
  useGetDashboardQuery,
  useGetDesignAnalyticsQuery,
  useGetListingAnalyticsQuery,
  useGetAgentAnalyticsQuery,
  useGetSearchAnalyticsQuery,
  useGetRoadmapQuery,
  useGetChangelogQuery,
} = dashboardApi;
