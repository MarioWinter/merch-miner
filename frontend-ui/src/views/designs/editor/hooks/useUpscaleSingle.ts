import { useCallback, useEffect, useReducer, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { designApi, useGetDesignsByIdsQuery } from '@/store/designSlice';
import {
  addProcessingDesignId,
  recordCompletion,
} from '@/store/upscaleSlice';
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
  /** When provided, invalidates the DesignProject tag on poll completion so the canvas refetches. */
  projectId?: string | null;
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
  /**
   * Pipeline-friendly variant: triggers (always with replace=true to bypass the
   * confirmation gate; caller is expected to have shown its own overwrite
   * dialog if needed) and resolves when polling detects an `upscaled_file`
   * change. Rejects on trigger error or the 20-min hard timeout.
   * The existing fire-and-forget `triggerUpscale` API is unchanged.
   */
  runUpscaleAsync: () => Promise<void>;
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
  projectId,
}: UseUpscaleSingleArgs): UseUpscaleSingleReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const reduxDispatch = useDispatch();

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
  // Promise resolvers/rejecters held while a runUpscaleAsync() is awaiting the
  // poll-complete or timeout signal. Drained on either terminal effect below.
  const pendingPromisesRef = useRef<
    Array<{ resolve: () => void; reject: (err: Error) => void }>
  >([]);

  const drainPendingPromises = useCallback(
    (outcome: 'resolve' | 'reject', err?: Error) => {
      const pending = pendingPromisesRef.current;
      pendingPromisesRef.current = [];
      pending.forEach((p) => {
        if (outcome === 'resolve') p.resolve();
        else p.reject(err ?? new Error('Upscale failed'));
      });
    },
    [],
  );

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
      // Phase 10 — snackbar firing is hoisted to the workspace level so that
      // exactly one snackbar fires per completion regardless of which tab the
      // user is on. We only record the completion here.
      reduxDispatch(
        recordCompletion({
          designId: designId ?? null,
          projectId: projectId ?? null,
          kind: 'success',
          ts: Date.now(),
        }),
      );
      // triggerSingle mutation only invalidates UpscaleQuota — the canvas reads
      // designs via the DesignProject query, so we invalidate that tag here.
      if (projectId) {
        reduxDispatch(
          designApi.util.invalidateTags([{ type: 'DesignProject', id: projectId }]),
        );
      }
      drainPendingPromises('resolve');
    }
  }, [currentDesign, designId, drainPendingPromises, pollEnabled, projectId, reduxDispatch]);

  // Phase 9 — maintain workspace-level shimmer set: while polling is active for
  // this designId, broadcast it via the upscaleSlice so the canvas can render a
  // shimmer overlay on any artboard linked to the same Design. Phase-10 fix:
  // no cleanup-on-unmount — the set survives tab switches (the hook unmounts
  // when DesignEditorView is hidden). Workspace-level monitor in
  // DesignWorkspaceView watches `boardData` against `processingDesignIds`
  // and dispatches `recordCompletion` once `upscaled_file` flips, which
  // clears the entry via the slice reducer.
  useEffect(() => {
    if (!pollEnabled || !designId) return;
    reduxDispatch(addProcessingDesignId(designId));
  }, [designId, pollEnabled, reduxDispatch]);

  // Hard timeout — after 20min, stop polling and surface error.
  useEffect(() => {
    if (!pollEnabled) return;
    timeoutRef.current = setTimeout(() => {
      dispatch({ type: 'STOP' });
      // Phase 10 — workspace-level snackbar fires from `recordCompletion`.
      reduxDispatch(
        recordCompletion({
          designId: designId ?? null,
          projectId: projectId ?? null,
          kind: 'error',
          reason: 'timeout',
          ts: Date.now(),
        }),
      );
      drainPendingPromises('reject', new Error('Upscale timed out'));
    }, POLL_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [designId, drainPendingPromises, pollEnabled, projectId, reduxDispatch]);

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
          drainPendingPromises('reject', new Error('Upscale quota exceeded'));
        } else if (status === 409) {
          // EC-1: a job is already running — adopt it as our active job.
          enqueueSnackbar(
            t('upscale.single.alreadyRunning', {
              defaultValue: 'An upscale is already running for this design.',
            }),
            { variant: 'info' },
          );
          // Adopt running job — START action without specific jobId (one is server-side).
          // Pending promises stay queued; they'll resolve when polling detects
          // the upscaled_file change for the in-flight server-side job.
          dispatch({ type: 'START', jobId: '' });
          initialUpscaledRef.current = currentDesign?.upscaled_file ?? null;
        } else {
          // Phase 10 — workspace-level snackbar fires from `recordCompletion`.
          reduxDispatch(
            recordCompletion({
              designId: designId ?? null,
              projectId: projectId ?? null,
              kind: 'error',
              reason: 'trigger_failed',
              ts: Date.now(),
            }),
          );
          drainPendingPromises('reject', new Error('Failed to start upscale'));
        }
      }
    },
    [
      cloudTarget,
      currentDesign,
      designId,
      destination,
      drainPendingPromises,
      enqueueSnackbar,
      projectId,
      reduxDispatch,
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

  const runUpscaleAsync = useCallback(() => {
    return new Promise<void>((resolve, reject) => {
      if (!designId) {
        reject(new Error('No designId for upscale'));
        return;
      }
      pendingPromisesRef.current.push({ resolve, reject });
      // Always force replace=true: pipeline callers are expected to have
      // shown their own overwrite dialog upstream.
      void startTrigger(true);
    });
  }, [designId, startTrigger]);

  return {
    isProcessing: pollEnabled,
    isTriggering,
    jobId,
    needsConfirmation,
    triggerUpscale,
    cancelConfirmation,
    runUpscaleAsync,
  };
};
