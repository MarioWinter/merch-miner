import {
  Alert,
  Box,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import { useTranslation } from 'react-i18next';
import { useRoadmap } from './hooks/useRoadmap';
import type { RoadmapItem } from '@/store/dashboardSlice';

const MAX_DESCRIPTION_LEN = 200;
const SCROLL_MAX_HEIGHT = 320;

/** Coloured dot indicating roadmap-item priority. Falls back to no dot
 *  when priority is undefined (rendered as `null` in the JSX). */
const PriorityDot = styled('span', {
  shouldForwardProp: (prop) => prop !== 'priority',
})<{ priority: 'high' | 'medium' | 'low' }>(({ theme, priority }) => {
  const color =
    priority === 'high'
      ? theme.vars.palette.error.main
      : priority === 'medium'
        ? theme.vars.palette.warning.main
        : theme.vars.palette.info.main;
  return {
    display: 'inline-block',
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: '50%',
    backgroundColor: color,
    marginTop: 6,
    marginRight: theme.spacing(1.25),
    flexShrink: 0,
  };
});

const ScrollableList = styled(List)({
  maxHeight: SCROLL_MAX_HEIGHT,
  overflowY: 'auto',
  paddingTop: 0,
  paddingBottom: 0,
});

const truncate = (text: string): string =>
  text.length > MAX_DESCRIPTION_LEN
    ? `${text.slice(0, MAX_DESCRIPTION_LEN)}…`
    : text;

interface RoadmapRowProps {
  item: RoadmapItem;
  priorityLabel: string;
}

const RoadmapRow = ({ item, priorityLabel }: RoadmapRowProps) => {
  const display = truncate(item.description);
  const isTruncated = display !== item.description;

  return (
    <ListItem alignItems="flex-start" sx={{ px: 0, py: 1 }}>
      {item.priority ? (
        <PriorityDot priority={item.priority} aria-label={priorityLabel} />
      ) : null}
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight={600}>
            {item.title}
          </Typography>
        }
        secondary={
          <Typography
            component="span"
            variant="caption"
            color="text.secondary"
            title={isTruncated ? item.description : undefined}
            sx={{ display: 'block' }}
          >
            {display}
          </Typography>
        }
      />
    </ListItem>
  );
};

const RoadmapWidget = () => {
  const { t, i18n } = useTranslation();
  const { items, lastUpdated, isLoading, isError } = useRoadmap();

  const priorityLabel = (p: 'high' | 'medium' | 'low'): string =>
    p === 'high'
      ? t('dashboard.roadmap.priority_high')
      : p === 'medium'
        ? t('dashboard.roadmap.priority_medium')
        : t('dashboard.roadmap.priority_low');

  const formattedDate =
    lastUpdated != null
      ? new Date(lastUpdated).toLocaleDateString(i18n.language || undefined)
      : null;

  return (
    <Card elevation={0}>
      <CardContent>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1 }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <RocketLaunchOutlinedIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="h6">
              {t('dashboard.roadmap.title')}
            </Typography>
          </Stack>
          {formattedDate ? (
            <Typography variant="caption" color="text.secondary">
              {t('dashboard.roadmap.caption_last_updated', { date: formattedDate })}
            </Typography>
          ) : null}
        </Stack>

        {isError ? (
          <Alert severity="warning" variant="outlined">
            {t('dashboard.roadmap.error')}
          </Alert>
        ) : isLoading ? (
          <Stack spacing={1}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        ) : items.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard.roadmap.empty_placeholder')}
            </Typography>
          </Box>
        ) : (
          <ScrollableList disablePadding>
            {items.map((item, idx) => (
              <RoadmapRow
                key={`${item.title}-${idx}`}
                item={item}
                priorityLabel={item.priority ? priorityLabel(item.priority) : ''}
              />
            ))}
          </ScrollableList>
        )}
      </CardContent>
    </Card>
  );
};

export default RoadmapWidget;
