import { useState, useCallback } from 'react';
import { Box, TextField, IconButton, Stack, Typography, Skeleton } from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveAgentSessionId } from '@/store/chatBarSlice';
import { useListTemplatesQuery } from '@/store/agentSlice';
import useAgentSession from './hooks/useAgentSession';
import useAgentControls from './hooks/useAgentControls';
import useApproval from './hooks/useApproval';
import AgentHeader from './partials/AgentHeader';
import WorkflowStepper from './partials/WorkflowStepper';
import AgentLog from './partials/AgentLog';
import QuickActionBar from './partials/QuickActionBar';
import OnboardingBanner from './partials/OnboardingBanner';
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
  const nicheContext = useAppSelector((s) => s.chatBar.nicheContext);

  // Active agent session is managed in Redux so external triggers (WorkflowCard
  // "Open Command Center") can switch it without parent re-mounts.
  const activeSessionId = useAppSelector((s) => s.chatBar.activeAgentSessionId);

  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
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

  const {
    pause,
    resume,
    stop,
    share,
    pausing,
    resuming,
    stopping,
  } = useAgentControls(activeSessionId);

  const { approve, reject, approving, rejecting } = useApproval(activeSessionId);

  const isIdle = !activeSession || activeSession.status === 'idle';
  const isCompleted =
    activeSession?.status === 'completed' || activeSession?.status === 'cancelled';

  const handleStartWorkflow = useCallback(
    async (templateKey: string) => {
      try {
        const session = await createSession({
          workflow_template: templateKey,
          niche_context: nicheContext?.id,
        });
        dispatch(setActiveAgentSessionId(session.id));
      } catch {
        enqueueSnackbar(t('agent.header.startError'), { variant: 'error' });
      }
    },
    [createSession, nicheContext, enqueueSnackbar, t, dispatch],
  );

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content) return;

    if (!activeSessionId) {
      try {
        const session = await createSession({
          niche_context: nicheContext?.id,
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
  }, [inputValue, activeSessionId, createSession, sendMessage, nicheContext, enqueueSnackbar, t, dispatch]);

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
        onSettings={() => setShowSettings(true)}
        onClearNiche={() => {
          /* niche context managed by parent */
        }}
        pausing={pausing}
        resuming={resuming}
        stopping={stopping}
        budgetPercent={0}
      />

      {workflowSteps.length > 0 && activeSession && (
        <WorkflowStepper
          steps={workflowSteps}
          completedSteps={activeSession.completed_steps}
          currentStep={activeSession.current_step}
          sessionStatus={activeSession.status}
        />
      )}

      {isIdle && showOnboarding && (
        <OnboardingBanner
          onSetup={() => setShowSettings(true)}
          onDismiss={() => setShowOnboarding(false)}
        />
      )}

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
