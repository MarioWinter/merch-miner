import { useState, useCallback, useMemo } from 'react';
import { Box, TextField, IconButton, Stack, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveAgentSessionId, setInputChip } from '@/store/chatBarSlice';
import {
  useListTemplatesQuery,
  useListSessionsQuery,
  useGetDashboardSummaryQuery,
} from '@/store/agentSlice';
import useAgentSession from './hooks/useAgentSession';
import useAgentControls from './hooks/useAgentControls';
import useApproval from './hooks/useApproval';
import AgentHeader from './partials/AgentHeader';
import WorkflowStepper from './partials/WorkflowStepper';
import AgentLog from './partials/AgentLog';
import QuickActionBar from './partials/QuickActionBar';
import OnboardingBanner from './partials/OnboardingBanner';
import OnboardingFlow from './partials/OnboardingFlow';
import BatchView from './partials/BatchView';
import AgentSettingsPage from './partials/AgentSettingsPage';

const PanelRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
});

const InputBar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 2),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  flexShrink: 0,
}));

const AgentPanel = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const inputChip = useAppSelector((s) => s.chatBar.inputChip);

  // Active agent session is managed in Redux so external triggers (WorkflowCard
  // "Open Command Center") can switch it without parent re-mounts.
  const activeSessionId = useAppSelector((s) => s.chatBar.activeAgentSessionId);

  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [onboardingFlowOpen, setOnboardingFlowOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const {
    activeSession,
    sessionLoading,
    creating,
    sending,
    createSession,
    sendMessage,
  } = useAgentSession({ activeSessionId });

  const { data: templates, isLoading: templatesLoading } = useListTemplatesQuery();
  const { data: dashboardSummary } = useGetDashboardSummaryQuery();

  // AC-56: surface batch siblings when the active session is part of a batch.
  const batchId = activeSession?.batch_id ?? null;
  const { data: batchSessionsResp, isLoading: batchLoading } = useListSessionsQuery(
    batchId ? { batch_id: batchId } : undefined,
    { skip: !batchId, pollingInterval: batchId ? 5_000 : 0 },
  );
  const batchSiblings = batchSessionsResp?.results ?? [];

  const {
    pause,
    resume,
    stop,
    share,
    unshare,
    pausing,
    resuming,
    stopping,
  } = useAgentControls(activeSessionId);

  // AC-60/AC-61: derive ownership + read-only flags so non-owners viewing a
  // shared session don't see Pause/Resume/Stop/Share controls (server would
  // 404 anyway; UI invariant must match).
  const currentUser = useAppSelector((s) => s.auth.user);
  const { isOwner, readOnly } = useMemo(() => {
    if (!activeSession) return { isOwner: true, readOnly: false };
    const owner = activeSession.created_by_email === currentUser?.email;
    return {
      isOwner: owner,
      readOnly: !owner && activeSession.is_shared,
    };
  }, [activeSession, currentUser?.email]);

  const { approve, reject, approving, rejecting } = useApproval(activeSessionId);

  const isIdle = !activeSession || activeSession.status === 'idle';
  const isCompleted =
    activeSession?.status === 'completed' || activeSession?.status === 'cancelled';

  const handleStartWorkflow = useCallback(
    async (templateKey: string) => {
      try {
        const session = await createSession({
          workflow_template: templateKey,
          niche_context: inputChip?.niche_id,
        });
        dispatch(setActiveAgentSessionId(session.id));
      } catch {
        enqueueSnackbar(t('agent.header.startError'), { variant: 'error' });
      }
    },
    [createSession, inputChip, enqueueSnackbar, t, dispatch],
  );

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content) return;

    if (!activeSessionId) {
      try {
        const session = await createSession({
          niche_context: inputChip?.niche_id,
          title: content.slice(0, 100),
        });
        dispatch(setActiveAgentSessionId(session.id));
        setInputValue('');
        // Send message after session is created
        // RTK Query will handle via the session detail refetch
      } catch {
        enqueueSnackbar(t('agent.header.startError'), { variant: 'error' });
      }
      return;
    }

    try {
      await sendMessage({ content });
      setInputValue('');
    } catch {
      enqueueSnackbar(t('agent.log.sendError'), { variant: 'error' });
    }
  }, [inputValue, activeSessionId, createSession, sendMessage, inputChip, enqueueSnackbar, t, dispatch]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (showSettings) {
    return (
      <AgentSettingsPage
        onBack={() => setShowSettings(false)}
        activePresetName={activeSession?.autonomy_preset ?? 'assisted'}
      />
    );
  }

  // Determine workflow steps from template
  const workflowSteps =
    activeSession?.workflow_template && templates
      ? (templates.find((t) => t.key === activeSession.workflow_template)?.steps ?? [])
      : [];

  return (
    <PanelRoot>
      <AgentHeader
        session={activeSession}
        onPause={pause}
        onResume={resume}
        onStop={stop}
        onShare={share}
        onUnshare={unshare}
        onSettings={() => setShowSettings(true)}
        onClearNiche={() => {
          // Clearing the chip clears the niche-context binding for new sessions.
          // The active session's niche_context is immutable (server-side state).
          dispatch(setInputChip(null));
        }}
        pausing={pausing}
        resuming={resuming}
        stopping={stopping}
        budgetPercent={dashboardSummary?.budget_pct ?? 0}
        isOwner={isOwner}
        readOnly={readOnly}
      />

      {workflowSteps.length > 0 && activeSession && (
        <WorkflowStepper
          steps={workflowSteps}
          completedSteps={activeSession.completed_steps}
          currentStep={activeSession.current_step}
          sessionStatus={activeSession.status}
        />
      )}

      {batchId && batchSiblings.length > 1 && (
        <BatchView
          sessions={batchSiblings}
          loading={batchLoading}
          onSelectSession={(id) => dispatch(setActiveAgentSessionId(id))}
        />
      )}

      {isIdle && showOnboarding && (
        <OnboardingBanner
          onSetup={() => setOnboardingFlowOpen(true)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

      <OnboardingFlow
        open={onboardingFlowOpen}
        onClose={() => setOnboardingFlowOpen(false)}
        onComplete={() => setShowOnboarding(false)}
      />


      {isIdle && !sessionLoading && (
        <QuickActionBar
          templates={templates ?? []}
          loading={templatesLoading}
          onStartWorkflow={handleStartWorkflow}
        />
      )}

      {sessionLoading ? (
        <Box sx={{ flex: 1, p: 2 }}>
          <Stack gap={1}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={48} />
            ))}
          </Stack>
        </Box>
      ) : activeSession ? (
        <AgentLog
          messages={activeSession.messages}
          loading={false}
          onApprove={approve}
          onReject={reject}
          approving={approving}
          rejecting={rejecting}
        />
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('agent.log.startPrompt')}
          </Typography>
        </Box>
      )}

      {isCompleted && activeSession?.error_message && (
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="caption" color="error.main">
            {activeSession.error_message}
          </Typography>
        </Box>
      )}

      <InputBar>
        <Stack direction="row" gap={0.5} alignItems="flex-end">
          <TextField
            size="small"
            fullWidth
            multiline
            maxRows={4}
            placeholder={t('agent.log.inputPlaceholder')}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={creating || sending}
          />
          <IconButton
            onClick={handleSend}
            disabled={!inputValue.trim() || creating || sending}
            color="primary"
            aria-label={t('agent.log.send')}
          >
            <SendIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Stack>
      </InputBar>
    </PanelRoot>
  );
};

export default AgentPanel;
