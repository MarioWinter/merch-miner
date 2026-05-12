/**
 * PROJ-29 Phase 1H-2 — confidence chip with color-coded dot prefix.
 * High = success / Medium = warning / Low = error. Color paired with text
 * label so colorblind users get the same signal (a11y).
 */
import { Chip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { SloganRow } from '@/types/chat-rag';

type Confidence = SloganRow['market_confidence'];

const Dot = styled('span', {
  shouldForwardProp: (prop) => prop !== 'level',
})<{ level: Confidence }>(({ theme, level }) => {
  const color =
    level === 'High'
      ? theme.vars.palette.success.main
      : level === 'Medium'
        ? theme.vars.palette.warning.main
        : theme.vars.palette.error.main;
  return {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: color,
    marginRight: theme.spacing(0.75),
  };
});

interface ConfidenceChipProps {
  level: Confidence;
}

const ConfidenceChip = ({ level }: ConfidenceChipProps) => {
  const { t } = useTranslation();
  const labelKey =
    level === 'High'
      ? 'chatNicheRag.slogans.confidence.high'
      : level === 'Medium'
        ? 'chatNicheRag.slogans.confidence.medium'
        : 'chatNicheRag.slogans.confidence.low';

  return (
    <Chip
      variant="outlined"
      size="small"
      label={
        <>
          <Dot level={level} />
          {t(labelKey)}
        </>
      }
      aria-label={`${t('chatNicheRag.slogans.col.confidence')}: ${t(labelKey)}`}
    />
  );
};

export default ConfidenceChip;
