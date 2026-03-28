import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MarketConfidence } from '../types';

interface MarketConfidenceBadgeProps {
  confidence: MarketConfidence;
}

const CONFIDENCE_CONFIG: Record<
  MarketConfidence,
  { color: 'success' | 'warning' | 'default' }
> = {
  High: { color: 'success' },
  Medium: { color: 'warning' },
  Low: { color: 'default' },
};

export const MarketConfidenceBadge = ({
  confidence,
}: MarketConfidenceBadgeProps) => {
  const { t } = useTranslation();
  const config = CONFIDENCE_CONFIG[confidence];

  return (
    <Chip
      label={t(`ideas.confidence.${confidence.toLowerCase()}`)}
      size="small"
      color={config.color}
      variant="outlined"
      aria-label={`Market confidence: ${confidence}`}
      sx={{ borderRadius: '6px', fontSize: '0.6875rem', height: 22 }}
    />
  );
};
