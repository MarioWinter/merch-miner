import { useState, useEffect, useCallback, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { researchApi } from '../services/researchApi';
import type {
  NicheResearchRun,
  ResearchRunStatus,
  ResearchTriggerParams,
} from '../types';

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 20 * 60 * 1_000; // 20 min

const isTerminal = (status: ResearchRunStatus): boolean =>
  status === 'completed' || status === 'failed';

interface UseNicheResearchReturn {
  data: NicheResearchRun | null;
  isLoading: boolean;
  isPolling: boolean;
  error: string | null;
  triggerResearch: (params?: ResearchTriggerParams) => Promise<void>;
  cancelResearch: () => Promise<void>;
  refetch: () => Promise<void>;
}

export const useNicheResearch = (nicheId: string | null): UseNicheResearchReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [data, setData] = useState<NicheResearchRun | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const fetchLatest = useCallback(async () => {
    if (!nicheId) return;
    try {
      const res = await researchApi.getLatestResearch(nicheId);
      if (!mountedRef.current) return;
      setData(res);
      setError(null);
      return res;
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setData(null);
        setError(null);
        return null;
      }
      setError(t('research.errors.fetchFailed'));
      return null;
    }
  }, [nicheId, t]);

  const startPolling = useCallback(
    (initialData?: NicheResearchRun) => {
      clearTimers();
      setIsPolling(true);

      if (initialData && isTerminal(initialData.status)) {
        setIsPolling(false);
        return;
      }

      pollTimerRef.current = setInterval(async () => {
        const res = await fetchLatest();
        if (!mountedRef.current) return;
        if (res && isTerminal(res.status)) {
          clearTimers();
          setIsPolling(false);
          if (res.status === 'completed') {
            enqueueSnackbar(t('research.notifications.completed'), { variant: 'success' });
          } else if (res.status === 'failed') {
            enqueueSnackbar(res.error_message || t('research.notifications.failed'), {
              variant: 'error',
            });
          }
        }
      }, POLL_INTERVAL_MS);

      timeoutTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        clearTimers();
        setIsPolling(false);
        setError(t('research.errors.timeout'));
      }, POLL_TIMEOUT_MS);
    },
    [clearTimers, fetchLatest, enqueueSnackbar, t],
  );

  // Reset + initial fetch on nicheId change
  useEffect(() => {
    if (!nicheId) {
      // Use a microtask to avoid synchronous setState in effect body
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setData(null);
        setError(null);
      });
      return;
    }

    let cancelled = false;

    (async () => {
      // Wrapped in async to satisfy lint (no synchronous setState in effect)
      setIsLoading(true);
      const res = await fetchLatest();
      if (cancelled) return;
      setIsLoading(false);
      if (res && !isTerminal(res.status)) {
        startPolling(res);
      }
    })();

    return () => {
      cancelled = true;
      clearTimers();
    };
  }, [nicheId, fetchLatest, startPolling, clearTimers]);

  const triggerResearch = useCallback(async (params?: ResearchTriggerParams) => {
    if (!nicheId) return;
    setError(null);
    try {
      const res = await researchApi.triggerResearch(nicheId, params);
      if (!mountedRef.current) return;
      setData(res);
      enqueueSnackbar(t('research.notifications.triggered'), { variant: 'info' });
      startPolling(res);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setError(t('research.errors.alreadyRunning'));
        enqueueSnackbar(t('research.errors.alreadyRunning'), { variant: 'warning' });
      } else if (status === 400) {
        const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
        setError(message ?? t('research.errors.triggerFailed'));
        enqueueSnackbar(message ?? t('research.errors.triggerFailed'), { variant: 'error' });
      } else {
        setError(t('research.errors.triggerFailed'));
        enqueueSnackbar(t('research.errors.triggerFailed'), { variant: 'error' });
      }
    }
  }, [nicheId, startPolling, enqueueSnackbar, t]);

  const cancelResearch = useCallback(async () => {
    if (!nicheId) return;
    try {
      const res = await researchApi.cancelResearch(nicheId);
      if (!mountedRef.current) return;
      clearTimers();
      setIsPolling(false);
      setData(res);
      enqueueSnackbar(t('research.notifications.cancelled'), { variant: 'info' });
    } catch {
      if (!mountedRef.current) return;
      enqueueSnackbar(t('research.errors.cancelFailed'), { variant: 'error' });
    }
  }, [nicheId, clearTimers, enqueueSnackbar, t]);

  const refetch = useCallback(async () => {
    if (!nicheId) return;
    setIsLoading(true);
    setError(null);
    const res = await fetchLatest();
    if (!mountedRef.current) return;
    setIsLoading(false);
    if (res && !isTerminal(res.status)) {
      startPolling(res);
    }
  }, [nicheId, fetchLatest, startPolling]);

  return { data, isLoading, isPolling, error, triggerResearch, cancelResearch, refetch };
};
