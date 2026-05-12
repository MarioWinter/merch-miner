/**
 * PROJ-29 Phase 1H — ThinkingStrip step row.
 *
 * One row of the live strip: `<icon> <label> <spacer> <duration?> <status-icon>`.
 * Icon + label come from `STAGE_META[stage]`; status icon swaps per `step.status`.
 * Respects `prefers-reduced-motion` — replaces CircularProgress with a static dot.
 */
import { useMemo } from 'react';
import { Box, CircularProgress, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { useTranslation } from 'react-i18next';
import { getStageMeta } from '../utils/stageMeta';
import type { ThinkingStep } from '../types/thinking';

interface StepRowProps {
  step: ThinkingStep;
  /** When true, swap the loading spinner for a static dot. */
  reducedMotion?: boolean;
}

const Row = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(0.75),
  padding: theme.spacing(0.25, 0),
  minHeight: 22,
}));

const Label = styled(Typography)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  color: theme.vars.palette.text.primary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const Duration = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
  whiteSpace: 'nowrap',
}));

const StepRow = ({ step, reducedMotion = false }: StepRowProps) => {
  const { t } = useTranslation();
  const meta = useMemo(() => getStageMeta(step.stage), [step.stage]);
  const StageIcon = meta.Icon;

  const label = meta.i18nKey ? t(meta.i18nKey, step.stage) : step.stage;

  const showDuration =
    step.status !== 'loading' && typeof step.durationMs === 'number';
  const durationText = showDuration
    ? `${(step.durationMs! / 1000).toFixed(1)}s`
    : null;

  let statusNode: React.ReactNode = null;
  if (step.status === 'loading') {
    statusNode = reducedMotion ? (
      <FiberManualRecordIcon
        color="secondary"
        aria-label={t('chatNicheRag.thinking.aria.loading', 'loading')}
        sx={{ fontSize: 14 }}
      />
    ) : (
      <CircularProgress
        size={12}
        color="secondary"
        aria-label={t('chatNicheRag.thinking.aria.loading', 'loading')}
      />
    );
  } else if (step.status === 'done') {
    statusNode = (
      <CheckCircleOutlineIcon
        aria-label={t('chatNicheRag.thinking.aria.done', 'done')}
        sx={{ fontSize: 14, color: 'success.main' }}
      />
    );
  } else if (step.status === 'warning') {
    statusNode = (
      <Tooltip title={step.message ?? ''} placement="left">
        <WarningAmberIcon
          aria-label={t('chatNicheRag.thinking.aria.warning', 'warning')}
          sx={{ fontSize: 14, color: 'warning.main' }}
        />
      </Tooltip>
    );
  } else if (step.status === 'error') {
    statusNode = (
      <Tooltip title={step.message ?? ''} placement="left">
        <ErrorOutlineIcon
          aria-label={t('chatNicheRag.thinking.aria.error', 'error')}
          sx={{ fontSize: 14, color: 'error.main' }}
        />
      </Tooltip>
    );
  }

  return (
    <Row data-stage={step.stage} data-status={step.status}>
      <Box sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}>
        <StageIcon sx={{ fontSize: 16 }} />
      </Box>
      <Label variant="body2">{label}</Label>
      {durationText && <Duration variant="caption">{durationText}</Duration>}
      {statusNode}
    </Row>
  );
};

export default StepRow;
