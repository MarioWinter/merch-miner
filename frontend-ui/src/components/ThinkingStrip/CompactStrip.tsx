/**
 * PROJ-29 Phase 1H — CompactStrip.
 *
 * Pill above the `<ExpandedSurface>` of `<FloatingChatBar />` shown while the
 * stream is in flight and the drawer is closed. Single-line:
 *   `[spinner] [stage-icon] <stage-label> · <elapsed>s`
 * Click → dispatch(openDrawer('chat')).
 *
 * Slide-in animation 200ms `EASING.enter`; respects `prefers-reduced-motion`.
 */
import { useMemo } from 'react';
import {
  Box,
  CircularProgress,
  Slide,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/store/hooks';
import { openDrawer } from '@/store/chatBarSlice';
import { useThinkingState } from './hooks/useThinkingState';
import { getStageMeta } from './utils/stageMeta';
import { DURATION } from '@/style/constants';

const PillButton = styled('button')(({ theme }) => ({
  all: 'unset',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.5, 1.5),
  borderRadius: 9999,
  backgroundColor: theme.vars.palette.primary.subtle,
  color: theme.vars.palette.text.primary,
  alignSelf: 'center',
  marginBottom: theme.spacing(0.5),
  maxWidth: '100%',
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
}));

const Label = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.primary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  fontWeight: 500,
})) as typeof Typography;

const CompactStrip = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const prefersReducedMotion = useMediaQuery(
    '(prefers-reduced-motion: reduce)',
  );
  const { isStreaming, currentLoadingStage, totalDurationMs } = useThinkingState();

  const stageLabel = useMemo(() => {
    if (!currentLoadingStage) {
      return t('chatNicheRag.thinking.compact.thinking', 'Thinking…');
    }
    const meta = getStageMeta(currentLoadingStage);
    return meta.i18nKey ? t(meta.i18nKey, currentLoadingStage) : currentLoadingStage;
  }, [currentLoadingStage, t]);

  const StageIcon = currentLoadingStage
    ? getStageMeta(currentLoadingStage).Icon
    : null;

  const elapsedText = `${(totalDurationMs / 1000).toFixed(1)}s`;

  if (!isStreaming) return null;

  const inner = (
    <PillButton
      type="button"
      onClick={() => dispatch(openDrawer('chat'))}
      aria-label={t(
        'chatNicheRag.thinking.compact.ariaLabel',
        'Agent is thinking. Click to open chat panel.',
      )}
      data-testid="thinking-compact-strip"
    >
      {!prefersReducedMotion && (
        <CircularProgress
          size={12}
          color="secondary"
          aria-hidden="true"
        />
      )}
      {StageIcon && (
        <Box sx={{ display: 'flex', color: 'secondary.main' }}>
          <StageIcon sx={{ fontSize: 16 }} />
        </Box>
      )}
      <Label variant="body2">
        {stageLabel} · {elapsedText}
      </Label>
    </PillButton>
  );

  if (prefersReducedMotion) {
    return <Box sx={{ display: 'flex', justifyContent: 'center' }}>{inner}</Box>;
  }

  return (
    <Slide in direction="up" timeout={DURATION.default} appear mountOnEnter>
      <Box sx={{ display: 'flex', justifyContent: 'center' }}>{inner}</Box>
    </Slide>
  );
};

export default CompactStrip;
