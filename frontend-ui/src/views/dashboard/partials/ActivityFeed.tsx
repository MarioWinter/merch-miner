import { Card, CardContent, List, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import ActivityItem from './ActivityItem';
import type { ActivityEvent } from '../types';

interface ActivityFeedProps {
  events: ActivityEvent[];
  isLoading: boolean;
}

const ActivityFeed = ({ events, isLoading }: ActivityFeedProps) => {
  const { t } = useTranslation();

  return (
    <Card elevation={0}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {t('dashboard.activity.title')}
        </Typography>
        {isLoading ? (
          <Stack spacing={1}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={44} />
            ))}
          </Stack>
        ) : events.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t('dashboard.activity.empty')}
          </Typography>
        ) : (
          <List disablePadding sx={{ maxHeight: 400, overflowY: 'auto' }}>
            {events.map((event, idx) => (
              <ActivityItem key={`${event.timestamp}-${idx}`} event={event} />
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
