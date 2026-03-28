import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './axiosBaseQuery';
import type { AppNotification, PaginatedResponse } from '../views/kanban/types';

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: axiosBaseQuery({ baseUrl: '' }),
  tagTypes: ['Notifications', 'UnreadCount'],
  endpoints: (builder) => ({
    // AC-21: List notifications
    listNotifications: builder.query<
      PaginatedResponse<AppNotification>,
      { isRead?: boolean; page?: number }
    >({
      query: ({ isRead, page } = {}) => ({
        url: '/api/notifications/',
        method: 'GET',
        params: {
          ...(isRead !== undefined ? { is_read: String(isRead) } : {}),
          ...(page ? { page } : {}),
        },
      }),
      providesTags: [{ type: 'Notifications', id: 'LIST' }],
    }),

    // AC-22: Mark single as read
    markNotificationRead: builder.mutation<
      AppNotification,
      { notificationId: string; isRead: boolean }
    >({
      query: ({ notificationId, isRead }) => ({
        url: `/api/notifications/${notificationId}/`,
        method: 'PATCH',
        data: { is_read: isRead },
      }),
      invalidatesTags: [
        { type: 'Notifications', id: 'LIST' },
        { type: 'UnreadCount', id: 'COUNT' },
      ],
    }),

    // AC-23: Mark all read
    markAllNotificationsRead: builder.mutation<{ updated: number }, void>({
      query: () => ({
        url: '/api/notifications/mark-all-read/',
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Notifications', id: 'LIST' },
        { type: 'UnreadCount', id: 'COUNT' },
      ],
    }),

    // AC-24: Unread count for badge
    getUnreadCount: builder.query<number, void>({
      query: () => ({
        url: '/api/notifications/unread-count/',
        method: 'GET',
      }),
      transformResponse: (response: { count: number }) => response.count,
      providesTags: [{ type: 'UnreadCount', id: 'COUNT' }],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetUnreadCountQuery,
} = notificationApi;
