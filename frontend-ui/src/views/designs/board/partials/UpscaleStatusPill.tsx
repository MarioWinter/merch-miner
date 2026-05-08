import { useEffect, useReducer } from 'react';
import { Chip, CircularProgress } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { openDrawer, setActiveBatch } from '@/store/upscaleSlice';
import { useUpscaleBatch } from '../hooks/useUpscaleBatch';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** How long the pill lingers after the batch reaches terminal state. */
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
  backgroundColor: 'rgba(0, 200, 215, 0.1)',
  border: `1px solid ${theme.vars.palette.secondary.main}40`,
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
  const { batch } = useUpscaleBatch({ activeBatchId });

  const [{ isFading }, fadeDispatch] = useReducer(fadeReducer, { isFading: false });

  // When batch reaches terminal state, fade out then clear from Redux/localStorage.
  useEffect(() => {
    if (!activeBatchId || !batch) return;
    if (!batch.is_terminal) return;
    fadeDispatch({ type: 'START_FADE' });
    const timer = setTimeout(() => {
      dispatch(setActiveBatch(null));
      fadeDispatch({ type: 'CLEAR' });
    }, TERMINAL_FADE_MS);
    return () => clearTimeout(timer);
  }, [activeBatchId, batch, dispatch]);

  // Hidden when no active batch.
  if (!activeBatchId) return null;

  const total = batch?.jobs.length ?? 0;
  const completed = batch?.jobs.filter(
    (j) => j.status === 'completed' || j.status === 'failed',
  ).length ?? 0;
  const label = total > 0
    ? t('upscale.pill.label', {
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
      onClick={() => dispatch(openDrawer())}
      aria-label={t('upscale.pill.ariaOpen', 'Open bulk upscale status')}
    />
  );
};

export default UpscaleStatusPill;
