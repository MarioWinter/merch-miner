import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetUnreadCountQuery,
  useListNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from '@/store/notificationSlice';

export const useNotifications = (dropdownOpen: boolean) => {
  const navigate = useNavigate();

  const { data: unreadCount = 0 } = useGetUnreadCountQuery(undefined, {
    pollingInterval: 30_000, // Poll every 30s (AC-32)
  });

  const { data: notificationsData, isLoading } = useListNotificationsQuery(
    {},
    { skip: !dropdownOpen },
  );

  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead] = useMarkAllNotificationsReadMutation();

  const notifications = notificationsData?.results ?? [];

  const handleClickNotification = useCallback(
    async (notificationId: string, link: string) => {
      await markRead({ notificationId, isRead: true });
      if (link) {
        navigate(link);
      }
    },
    [markRead, navigate],
  );

  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  return {
    unreadCount,
    notifications,
    isLoading,
    handleClickNotification,
    handleMarkAllRead,
  };
};
