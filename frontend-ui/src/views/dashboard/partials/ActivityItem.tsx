import { Avatar, ListItem, ListItemAvatar, ListItemText, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { COLORS } from '../../../style/constants';
import type { ActivityEvent } from '../types';

const AgentAvatar = styled(Avatar)({
  backgroundColor: alpha(COLORS.cyan, 0.15),
  color: COLORS.cyan,
  width: 32,
  height: 32,
});

const UserAvatar = styled(Avatar)(({ theme }) => ({
  backgroundColor: alpha(COLORS.red, 0.12),
  color: theme.vars.palette.primary.main,
  width: 32,
  height: 32,
}));

const formatRelativeTime = (timestamp: string): string => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

interface ActivityItemProps {
  event: ActivityEvent;
}

const ActivityItem = ({ event }: ActivityItemProps) => {
  const isAgent = !!event.agent_type;

  return (
    <ListItem disablePadding sx={{ py: 0.5, px: 0 }}>
      <ListItemAvatar sx={{ minWidth: 44 }}>
        {isAgent ? (
          <AgentAvatar>
            <SmartToyOutlinedIcon sx={{ fontSize: 18 }} />
          </AgentAvatar>
        ) : (
          <UserAvatar>
            <PersonOutlineIcon sx={{ fontSize: 18 }} />
          </UserAvatar>
        )}
      </ListItemAvatar>
      <ListItemText
        primary={
          <Typography variant="body2" component="span">
            <Typography variant="body2" component="span" fontWeight={600}>
              {isAgent ? event.agent_type : event.user}
            </Typography>
            {' '}
            {event.event.replace(/_/g, ' ')}
            {event.niche_name ? ` — ${event.niche_name}` : ''}
          </Typography>
        }
        secondary={
          <Typography variant="caption" color="text.secondary">
            {formatRelativeTime(event.timestamp)}
          </Typography>
        }
      />
    </ListItem>
  );
};

export default ActivityItem;
