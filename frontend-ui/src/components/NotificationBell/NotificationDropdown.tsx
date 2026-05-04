import {
  Box,
  Button,
  CircularProgress,
  Divider,
  Typography,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AlternateEmailIcon from '@mui/icons-material/AlternateEmail';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import { useTranslation } from 'react-i18next';
import type { AppNotification, NotificationType } from '@/views/kanban/types';

// ---------------------------------------------------------------------------
// Type icons
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<NotificationType, React.ReactNode> = {
  assignment: <AssignmentIndOutlinedIcon sx={{ fontSize: 18 }} />,
  approval: <CheckCircleOutlineIcon sx={{ fontSize: 18, color: 'success.main' }} />,
  rejection: <CancelOutlinedIcon sx={{ fontSize: 18, color: 'error.main' }} />,
  mention: <AlternateEmailIcon sx={{ fontSize: 18, color: 'info.main' }} />,
  status_change: <SwapHorizIcon sx={{ fontSize: 18, color: 'warning.main' }} />,
  agent_action: <SmartToyOutlinedIcon sx={{ fontSize: 18, color: 'secondary.main' }} />,
};

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const NotifItem = styled(Box, {
  shouldForwardProp: (p) => p !== '$isRead',
})<{ $isRead: boolean }>(({ theme, $isRead }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 1.5),
  cursor: 'pointer',
  borderRadius: 8,
  background: $isRead ? 'transparent' : alpha(theme.palette.primary.main, 0.04),
  '&:hover': {
    background: theme.vars.palette.action.hover,
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NotificationDropdownProps {
  notifications: AppNotification[];
  isLoading: boolean;
  onClickNotification: (id: string, link: string) => void;
  onMarkAllRead: () => void;
}

const NotificationDropdown = ({
  notifications,
  isLoading,
  onClickNotification,
  onMarkAllRead,
}: NotificationDropdownProps) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ width: 360, maxHeight: 420, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {t('kanban.notifications.title')}
        </Typography>
        <Button size="small" onClick={onMarkAllRead}>
          {t('kanban.notifications.markAllRead')}
        </Button>
      </Box>

      <Divider />

      {/* List */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 0.5 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 4 }}>
            {t('kanban.notifications.empty')}
          </Typography>
        ) : (
          notifications.map((n) => (
            <NotifItem
              key={n.id}
              $isRead={n.is_read}
              onClick={() => onClickNotification(n.id, n.link)}
              role="button"
              tabIndex={0}
              aria-label={n.title}
            >
              <Box sx={{ flexShrink: 0, mt: 0.25 }}>
                {TYPE_ICONS[n.type] ?? TYPE_ICONS.status_change}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: n.is_read ? 400 : 600 }}>
                  {n.title}
                </Typography>
                {n.message && (
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {n.message}
                  </Typography>
                )}
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                {formatTime(n.created_at)}
              </Typography>
            </NotifItem>
          ))
        )}
      </Box>
    </Box>
  );
};

export default NotificationDropdown;
