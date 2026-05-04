import { useState, useCallback } from 'react';
import { Badge, IconButton, Popover } from '@mui/material';
import { styled } from '@mui/material/styles';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/views/kanban/hooks/useNotifications';
import NotificationDropdown from './NotificationDropdown';

const BellButton = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
    color: theme.vars.palette.text.primary,
  },
}));

const NotificationBell = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const {
    unreadCount,
    notifications,
    isLoading,
    handleClickNotification,
    handleMarkAllRead,
  } = useNotifications(open);

  const handleOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const onClickItem = useCallback(
    (id: string, link: string) => {
      handleClickNotification(id, link);
      handleClose();
    },
    [handleClickNotification, handleClose],
  );

  return (
    <>
      <BellButton
        onClick={handleOpen}
        aria-label={t('kanban.notifications.bell')}
        size="small"
      >
        <Badge
          badgeContent={unreadCount}
          color="primary"
          max={99}
          sx={{
            '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 },
          }}
        >
          <NotificationsOutlinedIcon sx={{ fontSize: 20 }} />
        </Badge>
      </BellButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'divider',
              overflow: 'hidden',
            },
          },
        }}
      >
        <NotificationDropdown
          notifications={notifications}
          isLoading={isLoading}
          onClickNotification={onClickItem}
          onMarkAllRead={handleMarkAllRead}
        />
      </Popover>
    </>
  );
};

export default NotificationBell;
