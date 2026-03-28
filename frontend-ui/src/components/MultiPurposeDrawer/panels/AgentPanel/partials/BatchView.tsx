import {
  Stack,
  Typography,
  LinearProgress,
  Chip,
  Box,
  Skeleton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { AgentSession, SessionStatus } from '../types';

const BatchItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
}));

const statusColorMap: Record<SessionStatus, string> = {
  idle: 'default',
  running: 'info',
  paused: 'warning',
  completed: 'success',
  failed: 'error',
  cancelled: 'default',
};

interface BatchViewProps {
  sessions: AgentSession[];
  loading: boolean;
  onSelectSession: (id: string) => void;
}

const BatchView = ({ sessions, loading, onSelectSession }: BatchViewProps) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <Stack gap={1} sx={{ p: 2 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={56} />
        ))}
      </Stack>
    );
  }

  if (sessions.length === 0) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          {t('agent.batch.empty')}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack gap={1} sx={{ p: 2 }}>
      <Typography variant="subtitle2" color="text.secondary">
        {t('agent.batch.title')}
      </Typography>
      {sessions.map((session) => {
        const progress =
          session.total_steps > 0
            ? (session.completed_steps / session.total_steps) * 100
            : 0;
        return (
          <BatchItem
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {session.niche_context?.name ?? session.title}
              </Typography>
              <Chip
                label={t(`agent.stepper.status.${session.status}`)}
                size="small"
                color={statusColorMap[session.status] as 'default'}
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 3, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              {session.completed_steps}/{session.total_steps}{' '}
              {t('agent.stepper.steps')}
            </Typography>
          </BatchItem>
        );
      })}
    </Stack>
  );
};

export default BatchView;
