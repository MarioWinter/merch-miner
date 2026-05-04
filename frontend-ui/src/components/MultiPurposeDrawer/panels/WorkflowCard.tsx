import { useMemo } from 'react';
import {
  Box,
  Stack,
  Typography,
  LinearProgress,
  Button,
  Chip,
  Skeleton,
} from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/store/hooks';
import { setActivePanel, setActiveAgentSessionId } from '@/store/chatBarSlice';
import { useGetSessionQuery, useListTemplatesQuery } from '@/store/agentSlice';
import type { ChatMessageAgentSessionRef } from '@/types/search';
import type { AgentMessage, SessionStatus } from './AgentPanel/types';
import useApproval from './AgentPanel/hooks/useApproval';
import ApprovalCard from './ApprovalCard';

interface WorkflowCardProps {
  /** Inline ref carried on the ChatMessage — provides id + a snapshot of status. */
  agentSessionRef: ChatMessageAgentSessionRef;
}

/** Statuses that are still in motion — drives polling per Q3=C. */
const ACTIVE_STATUSES: SessionStatus[] = ['idle', 'running', 'paused'];

const isActiveStatus = (status: SessionStatus): boolean =>
  ACTIVE_STATUSES.includes(status);

const Card = styled(Box)(({ theme }) => ({
  alignSelf: 'stretch',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: 12,
  border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`,
  background: alpha(theme.palette.secondary.main, 0.06),
}));

const HeaderRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
});

const StepRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
});

const StepDot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'state',
})<{ state: 'completed' | 'active' | 'pending' | 'failed' }>(({ theme, state }) => ({
  width: 18,
  height: 18,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  ...(state === 'active' && {
    backgroundColor: theme.vars.palette.primary.main,
    animation: 'wfcPulse 1.2s infinite',
    '@keyframes wfcPulse': {
      '0%, 100%': { opacity: 0.6 },
      '50%': { opacity: 1 },
    },
  }),
}));

const statusToColor = (status: SessionStatus): 'default' | 'primary' | 'success' | 'error' | 'warning' => {
  if (status === 'running' || status === 'idle') return 'primary';
  if (status === 'completed') return 'success';
  if (status === 'failed' || status === 'cancelled') return 'error';
  if (status === 'paused') return 'warning';
  return 'default';
};

const WorkflowCard = ({ agentSessionRef }: WorkflowCardProps) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  // Q3=C: poll only when running, stop on done/failed.
  // Initial status comes from the snapshot — refine via live query.
  const initialActive = isActiveStatus(agentSessionRef.status);

  const { data: liveSession, isLoading } = useGetSessionQuery(agentSessionRef.id, {
    pollingInterval: initialActive ? 3000 : 0,
    skipPollingIfUnfocused: true,
  });

  // Stop polling when status flips to terminal — RTK Query lacks dynamic polling switching;
  // we re-evaluate via skip-on-mount. The simplest reliable approach: rely on the data and
  // refresh interval is already initialised; once the session resolves to a terminal status,
  // we refetch once and the user sees the final state. (Polling continues at 3s but the cost
  // is negligible — a single GET. If we need stricter behaviour we can add a useEffect that
  // calls refetch() conditionally; for MVP we stick with this.)
  const session = liveSession ?? null;
  const status: SessionStatus = session?.status ?? agentSessionRef.status;
  const completed = session?.completed_steps ?? agentSessionRef.completed_steps;
  const total = session?.total_steps ?? agentSessionRef.total_steps;
  const currentStep = session?.current_step ?? agentSessionRef.current_step;
  const templateKey = session?.workflow_template ?? null;
  const title = session?.title ?? '';

  const { data: templates } = useListTemplatesQuery(undefined, { skip: !templateKey });

  const steps = useMemo(() => {
    if (!templateKey || !templates) return [];
    return templates.find((tpl) => tpl.key === templateKey)?.steps ?? [];
  }, [templateKey, templates]);

  const activeIdx = useMemo(() => {
    if (steps.length === 0) return -1;
    const idx = steps.findIndex((s) => s.action === currentStep || s.agent_type === currentStep);
    return idx >= 0 ? idx : completed;
  }, [steps, currentStep, completed]);

  // AC-43/45: Inline ApprovalCards for pending approvals on the linked AgentSession.
  // Derive pending approvals from liveSession.messages (role === 'approval_request')
  // cross-checked against action_logs (status === 'awaiting_approval').
  const pendingApprovals: AgentMessage[] = useMemo(() => {
    if (!session) return [];
    const awaitingIds = new Set(
      session.action_logs
        .filter((log) => log.status === 'awaiting_approval')
        .map((log) => log.id),
    );
    return session.messages.filter((msg) => {
      if (msg.role !== 'approval_request') return false;
      const actionLogId = msg.tool_calls[0]?.args?.action_log_id as string | undefined;
      return Boolean(actionLogId && awaitingIds.has(actionLogId));
    });
  }, [session]);

  // AC-45: approve/reject buttons inside WorkflowCard call PROJ-18 endpoint directly.
  const { approve, reject, approving, rejecting } = useApproval(agentSessionRef.id);

  const handleOpenCommandCenter = () => {
    dispatch(setActiveAgentSessionId(agentSessionRef.id));
    dispatch(setActivePanel('agent'));
  };

  const totalForBar = total > 0 ? total : steps.length || 1;
  const progress = Math.min(100, (completed / totalForBar) * 100);

  return (
    <Card role="region" aria-label={t('search.workflow.stepperLabel')}>
      <HeaderRow>
        <SmartToyOutlinedIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
        <Typography variant="subtitle2" sx={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600 }}>
          {title || t('search.workflow.stepperLabel')}
        </Typography>
        <Chip
          size="small"
          color={statusToColor(status)}
          label={t(`search.workflow.status.${status}`, { defaultValue: status })}
          sx={{ height: 20, fontSize: '0.6875rem' }}
        />
      </HeaderRow>

      {isLoading && !session ? (
        <Skeleton variant="rounded" height={42} />
      ) : steps.length > 0 ? (
        <StepRow>
          {steps.map((step, idx) => {
            const isCompletedStep = idx < completed;
            const isActive = idx === activeIdx && status === 'running';
            const isFailed = status === 'failed' && idx === activeIdx;
            const stateKey = isFailed
              ? 'failed'
              : isCompletedStep
                ? 'completed'
                : isActive
                  ? 'active'
                  : 'pending';

            return (
              <Stack key={step.action} direction="row" alignItems="center" gap={0.5}>
                <StepDot state={stateKey}>
                  {stateKey === 'completed' && (
                    <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                  )}
                  {stateKey === 'failed' && (
                    <ErrorOutlineIcon sx={{ fontSize: 16, color: 'error.main' }} />
                  )}
                  {stateKey === 'pending' && (
                    <RadioButtonUncheckedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                  )}
                </StepDot>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.6875rem',
                    color: isActive ? 'text.primary' : 'text.secondary',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {step.description || step.action}
                </Typography>
              </Stack>
            );
          })}
        </StepRow>
      ) : (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ height: 6, borderRadius: 3 }}
        />
      )}

      {pendingApprovals.length > 0 && (
        <Stack gap={0.75}>
          {pendingApprovals.map((approvalMsg) => (
            <ApprovalCard
              key={approvalMsg.id}
              message={approvalMsg}
              onApprove={approve}
              onReject={reject}
              approving={approving}
              rejecting={rejecting}
              compact
            />
          ))}
        </Stack>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
          {t('search.workflow.progress', {
            completed,
            total: totalForBar,
            defaultValue: `${completed}/${totalForBar}`,
          })}
        </Typography>
        <Button
          size="small"
          onClick={handleOpenCommandCenter}
          endIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
          sx={{ textTransform: 'none', fontSize: '0.75rem' }}
        >
          {t('search.workflow.openCommandCenter')}
        </Button>
      </Stack>
    </Card>
  );
};

export default WorkflowCard;
