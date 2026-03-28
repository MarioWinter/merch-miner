import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useTriggerAdaptationMutation,
  useGetAdaptationRunQuery,
} from '@/store/ideaSlice';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import type { IdeaAdaptationRun, AdaptationRunStatus } from '../types';

const TERMINAL_STATES: AdaptationRunStatus[] = ['completed', 'failed'];

interface UseAdaptationReturn {
  triggerAdaptation: (ideaId: string, targetNicheIds: string[]) => Promise<void>;
  run: IdeaAdaptationRun | undefined;
  isTriggering: boolean;
  isPolling: boolean;
  error: string | null;
  reset: () => void;
}

const isTerminal = (s: AdaptationRunStatus) => TERMINAL_STATES.includes(s);

export const useAdaptation = (): UseAdaptationReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [trigger, { isLoading: isTriggering }] = useTriggerAdaptationMutation();
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Polling interval as state so we can stop it from an effect
  const [pollInterval, setPollInterval] = useState(0);
  const notifiedRef = useRef<AdaptationRunStatus | null>(null);

  const { data: run } = useGetAdaptationRunQuery(runId!, {
    skip: !runId,
    pollingInterval: pollInterval,
  });

  const isPolling = pollInterval > 0;

  // Stop polling + notify on terminal state
  // setPollInterval synchronizes local state with external query data — valid effect use
  useEffect(() => {
    if (!run) return;
    if (isTerminal(run.status)) {
      setPollInterval(0); // eslint-disable-line react-hooks/set-state-in-effect -- syncs with RTK Query
      if (notifiedRef.current !== run.status) {
        notifiedRef.current = run.status;
        if (run.status === 'completed') {
          enqueueSnackbar(t('ideas.adapt.completed'), { variant: 'success' });
        } else if (run.status === 'failed') {
          enqueueSnackbar(run.error_message || t('ideas.adapt.failed'), {
            variant: 'error',
          });
        }
      }
    }
  }, [run, enqueueSnackbar, t]);

  const triggerAdaptation = useCallback(
    async (ideaId: string, targetNicheIds: string[]) => {
      setError(null);
      try {
        const result = await trigger({
          ideaId,
          target_niche_ids: targetNicheIds,
        }).unwrap();
        setRunId(result.id);
        setPollInterval(3000);
        notifiedRef.current = null;
        enqueueSnackbar(t('ideas.adapt.started'), { variant: 'info' });
      } catch (err: unknown) {
        const msg =
          (err as { data?: { detail?: string } })?.data?.detail ||
          t('ideas.adapt.error');
        setError(msg);
        enqueueSnackbar(msg, { variant: 'error' });
      }
    },
    [trigger, enqueueSnackbar, t],
  );

  const reset = useCallback(() => {
    setRunId(null);
    setError(null);
    setPollInterval(0);
    notifiedRef.current = null;
  }, []);

  return { triggerAdaptation, run, isTriggering, isPolling, error, reset };
};
