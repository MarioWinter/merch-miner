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
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useGetConfigQuery } from '@/store/agentSlice';
import type { AgentSessionDetail } from '../types';
import { AGENT_DEFAULTS } from '../types';
import ReflectionStatus from './ReflectionStatus';

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
  onUnshare: () => void;
  onSettings: () => void;
  onClearNiche: () => void;
  pausing: boolean;
  resuming: boolean;
  stopping: boolean;
  budgetPercent: number;
  /** AC-60/AC-61: Hide owner-only controls when the current user is not the
   *  session owner (share button + pause/resume/stop). The Settings button
   *  remains visible — settings are workspace-scoped. */
  isOwner?: boolean;
  /** AC-61: When true the entire panel is read-only (non-owner viewing a
   *  shared session). Adds a "Read-only — Shared by ..." chip and suppresses
   *  pause/resume/stop. */
  readOnly?: boolean;
  /** AC-80: invoked when user clicks the ReflectionStatus chip — parent
   *  should open AgentSettingsPage on the Memory tab. */
  onOpenMemory?: () => void;
}

const AgentHeader = ({
  session,
  onPause,
  onResume,
  onStop,
  onShare,
  onUnshare,
  onSettings,
  onClearNiche,
  pausing,
  resuming,
  stopping,
  budgetPercent,
  isOwner = true,
  readOnly = false,
  onOpenMemory,
}: AgentHeaderProps) => {
  const { t } = useTranslation();
  const { data: configs } = useGetConfigQuery();
  const isRunning = session?.status === 'running';
  const isPaused = session?.status === 'paused';
  // AC-61: hide pause/resume/stop for non-owners on shared sessions, even
  // while running. AC-43 still applies for terminal states.
  const hasControls = (isRunning || isPaused) && !readOnly;
  const isShared = session?.is_shared ?? false;
  const sharedByLabel =
    session?.created_by_email || session?.created_by_username || '';

  // AC-55c: surface the Orchestrator's display name + avatar in the header.
  // Falls back to the static defaults until config has loaded.
  const orchestrator = configs?.find((c) => c.agent_type === 'orchestrator');
  const orchestratorEmoji =
    orchestrator?.avatar_emoji || AGENT_DEFAULTS.orchestrator.emoji;
  const orchestratorName =
    orchestrator?.display_name || AGENT_DEFAULTS.orchestrator.name;

  return (
    <HeaderRoot>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              sx={{ fontSize: '1.125rem', lineHeight: 1 }}
              aria-hidden
            >
              {orchestratorEmoji}
            </Typography>
            <Typography
              variant="subtitle2"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              {orchestratorName}
            </Typography>
          </Stack>
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
          {readOnly && sharedByLabel && (
            <Chip
              icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
              label={t('agent.share.readOnly', { name: sharedByLabel })}
              size="small"
              variant="outlined"
              color="info"
              sx={{ maxWidth: 220 }}
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
          <ReflectionStatus onOpenMemory={onOpenMemory} />
          {isOwner && (
            <Tooltip
              title={t(isShared ? 'agent.header.unshare' : 'agent.header.share')}
            >
              <IconButton
                size="small"
                onClick={isShared ? onUnshare : onShare}
                aria-label={t(
                  isShared ? 'agent.header.unshare' : 'agent.header.share',
                )}
                aria-pressed={isShared}
                color={isShared ? 'primary' : 'default'}
              >
                {isShared ? (
                  <ShareIcon sx={{ fontSize: 18 }} />
                ) : (
                  <ShareOutlinedIcon sx={{ fontSize: 18 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
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
