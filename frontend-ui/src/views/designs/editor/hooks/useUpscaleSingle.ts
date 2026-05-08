import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useGetDesignsByIdsQuery } from '@/store/designSlice';
import {
  useTriggerSingleMutation,
  type UpscaleCloudTarget,
  type UpscaleDestination,
} from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Polling configuration — mirrors useNicheResearch (5s interval, 20min cap)
// -----------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 20 * 60 * 1_000;

interface QuotaErrorPayload {
  error?: string;
  used?: number;
  limit?: number;
  resets_on?: string;
}

interface UseUpscaleSingleArgs {
  designId: string | null;
  destination: UpscaleDestination;
  cloudTarget: UpscaleCloudTarget | null;
}

interface UseUpscaleSingleReturn {
  isProcessing: boolean;
  /** True while the trigger request is in flight (button loading state). */
  isTriggering: boolean;
  /** Set after a successful trigger; cleared on terminal state. */
  jobId: string | null;
  /** Re-upscale gate — true when target design already has `upscaled_file`. */
  needsConfirmation: boolean;
  /** Trigger an upscale (with replace flag for re-upscale). */
  triggerUpscale: (opts?: { replace?: boolean }) => Promise<void>;
  /** Cancel the pending re-upscale confirmation. */
  cancelConfirmation: () => void;
}

/**
 * Single-design upscale flow:
 *  1. trigger Replicate prediction via mutation
 *  2. poll the design by id every 5s for `upscaled_file` change
 *  3. terminal: success snackbar + stop polling
 *
 * The 5s polling cadence + Page Visibility behavior intentionally matches
 * `useNicheResearch` so users see a consistent rhythm across features.
 */
export const useUpscaleSingle = ({
  designId,
  destination,
  cloudTarget,
}: UseUpscaleSingleArgs): UseUpscaleSingleReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [trigger, { isLoading: isTriggering }] = useTriggerSingleMutation();

  // Polling state machine — useReducer keeps related setState calls atomic
  // (and dispatch in effects passes the React 19 cascading-renders rule).
  type PollAction =
    | { type: 'START'; jobId: string }
    | { type: 'STOP' }
    | { type: 'ASK_CONFIRM' }
    | { type: 'CANCEL_CONFIRM' };
  interface PollState {
    jobId: string | null;
    pollEnabled: boolean;
    needsConfirmation: boolean;
  }
  const [pollState, dispatch] = useReducer(
    (state: PollState, action: PollAction): PollState => {
      switch (action.type) {
        case 'START':
          return { jobId: action.jobId, pollEnabled: true, needsConfirmation: false };
        case 'STOP':
          return { jobId: null, pollEnabled: false, needsConfirmation: false };
        case 'ASK_CONFIRM':
          return { ...state, needsConfirmation: true };
        case 'CANCEL_CONFIRM':
          return { ...state, needsConfirmation: false };
        default:
          return state;
      }
    },
    { jobId: null, pollEnabled: false, needsConfirmation: false },
  );
  const { jobId, pollEnabled, needsConfirmation } = pollState;

  const initialUpscaledRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // RTK Query design poller — pauses when tab is hidden via skipPollingIfUnfocused.
  const designIds = designId ? [designId] : [];
  const { data: designs } = useGetDesignsByIdsQuery(designIds, {
    skip: designIds.length === 0,
    pollingInterval: pollEnabled ? POLL_INTERVAL_MS : 0,
    skipPollingIfUnfocused: true,
  });

  const currentDesign = designs?.[0] ?? null;

  // Watch for `upscaled_file` change → terminal success path.
  useEffect(() => {
    if (!pollEnabled || !currentDesign) return;
    const baseline = initialUpscaledRef.current;
    if (currentDesign.upscaled_file && currentDesign.upscaled_file !== baseline) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      dispatch({ type: 'STOP' });
      enqueueSnackbar(
        t('upscale.single.success', { defaultValue: 'Upscaled to 4500×5400' }),
        { variant: 'success' },
      );
    }
  }, [currentDesign, enqueueSnackbar, pollEnabled, t]);

  // Hard timeout — after 20min, stop polling and surface error.
  useEffect(() => {
    if (!pollEnabled) return;
    timeoutRef.current = setTimeout(() => {
      dispatch({ type: 'STOP' });
      enqueueSnackbar(
        t('upscale.single.timeout', {
          defaultValue: 'Upscale is taking longer than expected — check back later.',
        }),
        { variant: 'warning' },
      );
    }, POLL_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [enqueueSnackbar, pollEnabled, t]);

  const startTrigger = useCallback(
    async (replace: boolean) => {
      if (!designId) return;
      try {
        const response = await trigger({
          designId,
          body: {
            destination,
            cloud_target: cloudTarget ?? undefined,
            replace,
          },
        }).unwrap();
        // Snapshot the pre-trigger upscaled_file so we can detect "new" state.
        initialUpscaledRef.current = currentDesign?.upscaled_file ?? null;
        dispatch({ type: 'START', jobId: response.job_id });
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const data = (err as { data?: QuotaErrorPayload })?.data;
        if (status === 402) {
          enqueueSnackbar(
            t('upscale.single.quotaExceeded', {
              defaultValue: 'Monthly quota exceeded — resets {{resets_on}}',
              resets_on: data?.resets_on ?? '—',
            }),
            { variant: 'error' },
          );
        } else if (status === 409) {
          // EC-1: a job is already running — adopt it as our active job.
          enqueueSnackbar(
            t('upscale.single.alreadyRunning', {
              defaultValue: 'An upscale is already running for this design.',
            }),
            { variant: 'info' },
          );
          // Adopt running job — START action without specific jobId (one is server-side).
          dispatch({ type: 'START', jobId: '' });
          initialUpscaledRef.current = currentDesign?.upscaled_file ?? null;
        } else {
          enqueueSnackbar(
            t('upscale.single.error', { defaultValue: 'Failed to start upscale' }),
            { variant: 'error' },
          );
        }
      }
    },
    [
      cloudTarget,
      currentDesign,
      designId,
      destination,
      enqueueSnackbar,
      t,
      trigger,
    ],
  );

  const triggerUpscale = useCallback(
    async (opts?: { replace?: boolean }) => {
      if (!designId) return;
      const replace = opts?.replace ?? false;
      const alreadyHasUpscaled = !!currentDesign?.upscaled_file;
      // First click on an already-upscaled design → ask for confirmation.
      if (alreadyHasUpscaled && !replace) {
        dispatch({ type: 'ASK_CONFIRM' });
        return;
      }
      await startTrigger(replace);
    },
    [currentDesign, designId, startTrigger],
  );

  const cancelConfirmation = useCallback(() => {
    dispatch({ type: 'CANCEL_CONFIRM' });
  }, []);

  return {
    isProcessing: pollEnabled,
    isTriggering,
    jobId,
    needsConfirmation,
    triggerUpscale,
    cancelConfirmation,
  };
};
