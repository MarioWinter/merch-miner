import {
  Stack,
  Chip,
  IconButton,
  LinearProgress,
  Tooltip,
  Typography,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import ShareIcon from '@mui/icons-material/Share';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import type { AgentSessionDetail } from '../types';

const HeaderRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  flexShrink: 0,
}));

const BudgetBar = styled(LinearProgress)(({ theme }) => ({
  height: 4,
  borderRadius: 2,
  backgroundColor: `rgba(255,255,255,0.08)`,
  '& .MuiLinearProgress-bar': {
    borderRadius: 2,
    backgroundColor: theme.vars.palette.secondary.main,
  },
}));

interface AgentHeaderProps {
  session: AgentSessionDetail | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onShare: () => void;
  onSettings: () => void;
  onClearNiche: () => void;
  pausing: boolean;
  resuming: boolean;
  stopping: boolean;
  budgetPercent: number;
}

const AgentHeader = ({
  session,
  onPause,
  onResume,
  onStop,
  onShare,
  onSettings,
  onClearNiche,
  pausing,
  resuming,
  stopping,
  budgetPercent,
}: AgentHeaderProps) => {
  const { t } = useTranslation();
  const isRunning = session?.status === 'running';
  const isPaused = session?.status === 'paused';
  const hasControls = isRunning || isPaused;

  return (
    <HeaderRoot>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
          {session?.autonomy_preset && (
            <Chip
              label={session.autonomy_preset}
              size="small"
              variant="outlined"
              sx={{ textTransform: 'capitalize' }}
            />
          )}
          {session?.niche_context && (
            <Chip
              label={session.niche_context.name}
              size="small"
              onDelete={onClearNiche}
              deleteIcon={<CloseIcon sx={{ fontSize: 14 }} />}
              sx={{ maxWidth: 160 }}
            />
          )}
        </Stack>

        <Stack direction="row" alignItems="center" gap={0.5}>
          {hasControls && (
            <>
              {isRunning && (
                <Tooltip title={t('agent.header.pause')}>
                  <IconButton size="small" onClick={onPause} disabled={pausing}>
                    <PauseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              {isPaused && (
                <Tooltip title={t('agent.header.resume')}>
                  <IconButton size="small" onClick={onResume} disabled={resuming}>
                    <PlayArrowIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t('agent.header.stop')}>
                <IconButton size="small" onClick={onStop} disabled={stopping}>
                  <StopIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={t('agent.header.share')}>
            <IconButton size="small" onClick={onShare}>
              <ShareIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title={t('agent.settings.title')}>
            <IconButton size="small" onClick={onSettings}>
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {budgetPercent > 0 && (
        <Stack direction="row" alignItems="center" gap={1}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {t('agent.budget.label')}
          </Typography>
          <BudgetBar
            variant="determinate"
            value={Math.min(budgetPercent, 100)}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            {budgetPercent}%
          </Typography>
        </Stack>
      )}
    </HeaderRoot>
  );
};

export default AgentHeader;
