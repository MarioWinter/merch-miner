import { useCallback } from 'react';
import {
  usePauseSessionMutation,
  useResumeSessionMutation,
  useStopSessionMutation,
  useShareSessionMutation,
  useUnshareSessionMutation,
} from '@/store/agentSlice';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

const useAgentControls = (sessionId: string | null) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [pauseSession, { isLoading: pausing }] = usePauseSessionMutation();
  const [resumeSession, { isLoading: resuming }] = useResumeSessionMutation();
  const [stopSession, { isLoading: stopping }] = useStopSessionMutation();
  const [shareSession] = useShareSessionMutation();
  const [unshareSession] = useUnshareSessionMutation();

  const handlePause = useCallback(async () => {
    if (!sessionId) return;
    try {
      await pauseSession(sessionId).unwrap();
      enqueueSnackbar(t('agent.header.paused'), { variant: 'info' });
    } catch {
      enqueueSnackbar(t('agent.header.pauseError'), { variant: 'error' });
    }
  }, [sessionId, pauseSession, enqueueSnackbar, t]);

  const handleResume = useCallback(async () => {
    if (!sessionId) return;
    try {
      await resumeSession(sessionId).unwrap();
      enqueueSnackbar(t('agent.header.resumed'), { variant: 'info' });
    } catch {
      enqueueSnackbar(t('agent.header.resumeError'), { variant: 'error' });
    }
  }, [sessionId, resumeSession, enqueueSnackbar, t]);

  const handleStop = useCallback(async () => {
    if (!sessionId) return;
    try {
      await stopSession(sessionId).unwrap();
      enqueueSnackbar(t('agent.header.stopped'), { variant: 'warning' });
    } catch {
      enqueueSnackbar(t('agent.header.stopError'), { variant: 'error' });
    }
  }, [sessionId, stopSession, enqueueSnackbar, t]);

  const handleShare = useCallback(async () => {
    if (!sessionId) return;
    try {
      await shareSession(sessionId).unwrap();
      enqueueSnackbar(t('agent.header.shared'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('agent.header.shareError'), { variant: 'error' });
    }
  }, [sessionId, shareSession, enqueueSnackbar, t]);

  const handleUnshare = useCallback(async () => {
    if (!sessionId) return;
    try {
      await unshareSession(sessionId).unwrap();
      enqueueSnackbar(t('agent.header.unshared'), { variant: 'info' });
    } catch {
      enqueueSnackbar(t('agent.header.unshareError'), { variant: 'error' });
    }
  }, [sessionId, unshareSession, enqueueSnackbar, t]);

  return {
    pause: handlePause,
    resume: handleResume,
    stop: handleStop,
    share: handleShare,
    unshare: handleUnshare,
    pausing,
    resuming,
    stopping,
  };
};

export default useAgentControls;
