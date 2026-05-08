import { useCallback, useEffect, useReducer } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/store/hooks';
import {
  closeDrawer as closeDrawerAction,
  openDrawer as openDrawerAction,
  setActiveBatch as setActiveBatchAction,
} from '@/store/upscaleSlice';
import {
  useGetBatchStatusQuery,
  useTriggerBulkMutation,
  type UpscaleBulkPayload,
  type UpscaleBatchJobRow,
  type UpscaleBatchStatusResponse,
} from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Polling configuration — mirrors useNicheResearch (5s, 20min cap)
// -----------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000;

interface QuotaErrorPayload {
  error?: string;
  used?: number;
  limit?: number;
  resets_on?: string;
}

interface PreflightState {
  open: boolean;
  used: number;
  limit: number;
  resets_on: string;
  selectedIds: string[];
}

interface UseUpscaleBatchArgs {
  /** Currently active batch id (may be null when no batch). */
  activeBatchId: string | null;
}

interface UseUpscaleBatchReturn {
  /** Live batch status from polling, or undefined while loading. */
  batch: UpscaleBatchStatusResponse | undefined;
  jobs: UpscaleBatchJobRow[];
  isFetchingStatus: boolean;
  isTriggering: boolean;
  /** Pre-flight dialog state when selection > remaining quota. */
  preflight: PreflightState;
  /** Trigger a fresh bulk batch with the given design ids. */
  triggerBulk: (
    designIds: string[],
    opts?: { replace?: boolean },
  ) => Promise<void>;
  /** Close the preflight dialog without submitting. */
  closePreflight: () => void;
  /** Confirm submission of first-N from preflight dialog. */
  confirmPreflightFirstN: (replace?: boolean) => Promise<void>;
}

// -----------------------------------------------------------------
// Reducer state machine — mirrors useUpscaleSingle.
// React 19 forbids cascading setState chains in render/effects, so we
// keep all mutually-dependent state in one reducer.
// -----------------------------------------------------------------

type Action =
  | { type: 'START'; batchId: string }
  | { type: 'STOP' }
  | { type: 'PREFLIGHT_OPEN'; payload: PreflightState }
  | { type: 'PREFLIGHT_CLOSE' };

interface State {
  preflight: PreflightState;
}

const initialState: State = {
  preflight: { open: false, used: 0, limit: 0, resets_on: '', selectedIds: [] },
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'START':
    case 'STOP':
      return state;
    case 'PREFLIGHT_OPEN':
      return { ...state, preflight: action.payload };
    case 'PREFLIGHT_CLOSE':
      return { ...state, preflight: { ...state.preflight, open: false } };
    default:
      return state;
  }
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

export const useUpscaleBatch = ({
  activeBatchId,
}: UseUpscaleBatchArgs): UseUpscaleBatchReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const dispatchRedux = useAppDispatch();

  const [state, dispatch] = useReducer(reducer, initialState);

  const [trigger, { isLoading: isTriggering }] = useTriggerBulkMutation();

  // Polling auto-stops when batch is terminal (server marks `is_terminal=true`).
  const { data: batch, isFetching: isFetchingStatus } = useGetBatchStatusQuery(
    activeBatchId ?? '',
    {
      skip: !activeBatchId,
      pollingInterval:
        activeBatchId && !state.preflight.open ? POLL_INTERVAL_MS : 0,
      skipPollingIfUnfocused: true,
    },
  );

  const jobs = batch?.jobs ?? [];

  // Stop polling and surface terminal-state snackbar.
  useEffect(() => {
    if (!batch || !batch.is_terminal) return;
    const allOk = batch.jobs.every((j) => j.status === 'completed');
    const anyFail = batch.jobs.some((j) => j.status === 'failed');
    if (allOk) {
      enqueueSnackbar(
        t('upscale.bulk.success', {
          defaultValue: 'Bulk upscale complete · {{count}} done',
          count: batch.jobs.length,
        }),
        { variant: 'success' },
      );
    } else if (anyFail) {
      const failed = batch.jobs.filter((j) => j.status === 'failed').length;
      enqueueSnackbar(
        t('upscale.bulk.partial', {
          defaultValue: '{{failed}} of {{total}} failed — open drawer to retry',
          failed,
          total: batch.jobs.length,
        }),
        { variant: 'warning' },
      );
    }
  }, [batch, enqueueSnackbar, t]);

  const submitBulk = useCallback(
    async (designIds: string[], replace: boolean) => {
      try {
        const body: UpscaleBulkPayload = {
          design_ids: designIds,
          replace,
        };
        const response = await trigger(body).unwrap();
        // Only open the drawer if the backend actually created a batch.
        // batch_id can be null when ALL selected designs were filtered out
        // (already upscaled + replace=false, OR already in-progress).
        if (response.batch_id) {
          dispatchRedux(setActiveBatchAction(response.batch_id));
          dispatchRedux(openDrawerAction());
        } else {
          const skippedUpscaled = response.skipped_already_upscaled ?? 0;
          const skippedInProgress = response.skipped_in_progress ?? 0;
          const message = skippedUpscaled > 0
            ? t('upscale.bulk.allAlreadyUpscaled', {
                defaultValue:
                  '{{count}} selected design(s) already upscaled. Pick "Re-upscale all" to redo.',
                count: skippedUpscaled,
              })
            : skippedInProgress > 0
              ? t('upscale.bulk.allInProgress', {
                  defaultValue:
                    '{{count}} selected design(s) already have an upscale running.',
                  count: skippedInProgress,
                })
              : t('upscale.bulk.noEligible', {
                  defaultValue: 'No eligible designs in selection',
                });
          enqueueSnackbar(message, { variant: 'info' });
        }
      } catch (err) {
        const status = (err as { status?: number })?.status;
        const data = (err as { data?: QuotaErrorPayload })?.data;
        if (status === 402) {
          // Pre-flight quota error — open dialog with first-N option.
          dispatch({
            type: 'PREFLIGHT_OPEN',
            payload: {
              open: true,
              used: data?.used ?? 0,
              limit: data?.limit ?? 0,
              resets_on: data?.resets_on ?? '',
              selectedIds: designIds,
            },
          });
        } else {
          enqueueSnackbar(
            t('upscale.bulk.error', {
              defaultValue: 'Failed to start bulk upscale',
            }),
            { variant: 'error' },
          );
        }
      }
    },
    [dispatchRedux, enqueueSnackbar, t, trigger],
  );

  const triggerBulk = useCallback(
    async (designIds: string[], opts?: { replace?: boolean }) => {
      if (designIds.length === 0) return;
      await submitBulk(designIds, opts?.replace ?? false);
    },
    [submitBulk],
  );

  const closePreflight = useCallback(() => {
    dispatch({ type: 'PREFLIGHT_CLOSE' });
  }, []);

  const confirmPreflightFirstN = useCallback(
    async (replace?: boolean) => {
      const { selectedIds, limit, used } = state.preflight;
      const remaining = Math.max(0, limit - used);
      const firstN = selectedIds.slice(0, remaining);
      dispatch({ type: 'PREFLIGHT_CLOSE' });
      await submitBulk(firstN, replace ?? false);
    },
    [state.preflight, submitBulk],
  );

  // When activeBatchId is cleared, also close drawer.
  useEffect(() => {
    if (!activeBatchId) {
      dispatchRedux(closeDrawerAction());
    }
  }, [activeBatchId, dispatchRedux]);

  return {
    batch,
    jobs,
    isFetchingStatus,
    isTriggering,
    preflight: state.preflight,
    triggerBulk,
    closePreflight,
    confirmPreflightFirstN,
  };
};
