import { useCallback, useEffect, useReducer } from 'react';
import { Chip, CircularProgress } from '@mui/material';
import { alpha, styled, keyframes } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openDrawer, setActiveBatch } from '@/store/upscaleSlice';
import { COLORS } from '@/style/constants';
import { useUpscaleBatch } from '@/views/designs/board/hooks/useUpscaleBatch';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** How long the pill lingers after the last in-flight job reaches terminal state. */
const TERMINAL_FADE_MS = 3_000;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; transform: translateX(8px); }
`;

const Pill = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'isFading',
})<{ isFading: boolean }>(({ theme, isFading }) => ({
  height: 28,
  borderRadius: 14,
  paddingInline: 4,
  fontSize: 12,
  fontWeight: 500,
  color: theme.vars.palette.secondary.main,
  backgroundColor: alpha(COLORS.cyan, 0.1),
  border: `1px solid ${alpha(COLORS.cyan, 0.25)}`,
  cursor: 'pointer',
  transition: 'background-color 150ms ease',
  '& .MuiChip-icon': {
    color: theme.vars.palette.secondary.main,
    marginLeft: 6,
  },
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
  ...(isFading && {
    animation: `${fadeOut} ${TERMINAL_FADE_MS}ms ease forwards`,
  }),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

type FadeAction = { type: 'START_FADE' } | { type: 'CLEAR' };

const fadeReducer = (
  state: { isFading: boolean },
  action: FadeAction,
): { isFading: boolean } => {
  switch (action.type) {
    case 'START_FADE':
      return { isFading: true };
    case 'CLEAR':
      return { isFading: false };
    default:
      return state;
  }
};

const UpscaleStatusPill = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const activeBatchId = useAppSelector((s) => s.upscale.activeBatchId);
  const processingDesignIds = useAppSelector(
    (s) => s.upscale.processingDesignIds,
  );
  const { batch } = useUpscaleBatch({ activeBatchId });

  const [{ isFading }, fadeDispatch] = useReducer(fadeReducer, {
    isFading: false,
  });

  // Aggregate counts across batch + single-design jobs.
  const batchTotal = batch?.jobs.length ?? 0;
  const batchCompleted = batch?.jobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed',
  ).length ?? 0;
  const singleTotal = processingDesignIds.length;
  // Single-design jobs are removed from `processingDesignIds` once they hit a
  // terminal state, so the "completed" portion of singles is implicit (0
  // in-flight + N already gone). The summed counter therefore only credits the
  // batch-side completion, but the total includes both buckets.
  const total = batchTotal + singleTotal;
  const completed = batchCompleted;

  const hasSingleInFlight = singleTotal > 0;
  const batchIsTerminal = batch?.is_terminal === true;
  // The pill is visible when either bucket has work to show. We only start the
  // fade-out when BOTH buckets are settled — a terminal batch alongside an
  // active single-design upscale must keep the pill visible.
  const anyActive = Boolean(activeBatchId) || hasSingleInFlight;
  const everythingSettled =
    !hasSingleInFlight && (!activeBatchId || batchIsTerminal);

  // When everything settles, fade out then clear the active-batch ref from
  // Redux/localStorage. Singles clean themselves up via `recordCompletion`.
  useEffect(() => {
    if (!anyActive) return;
    if (!everythingSettled) return;
    fadeDispatch({ type: 'START_FADE' });
    const timer = setTimeout(() => {
      if (activeBatchId) dispatch(setActiveBatch(null));
      fadeDispatch({ type: 'CLEAR' });
    }, TERMINAL_FADE_MS);
    return () => clearTimeout(timer);
  }, [activeBatchId, anyActive, dispatch, everythingSettled]);

  // FIX-canvas-editor-bugs-and-image-gen Phase D #2 — click dispatches the
  // global drawerOpen flag. The BulkUpscaleDrawer is mounted once in App.tsx
  // and subscribes to that flag, so we no longer render any drawer locally.
  const handleClick = useCallback(() => {
    dispatch(openDrawer());
  }, [dispatch]);

  // Hidden when nothing is in flight.
  if (!anyActive) return null;

  const labelKey =
    hasSingleInFlight && batchTotal > 0
      ? 'upscale.pill.combinedLabel'
      : 'upscale.pill.label';
  const label =
    total > 0
      ? t(labelKey, {
          defaultValue: 'Upscaling {{completed}}/{{total}}',
          completed,
          total,
        })
      : t('upscale.pill.starting', { defaultValue: 'Upscaling…' });

  return (
    <Pill
      isFading={isFading}
      icon={<CircularProgress size={12} thickness={5} color="inherit" />}
      label={label}
      onClick={handleClick}
      aria-label={t('upscale.pill.drawerOpenAria', 'Show running upscales')}
    />
  );
};

export default UpscaleStatusPill;
