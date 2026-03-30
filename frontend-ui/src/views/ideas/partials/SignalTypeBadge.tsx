import { Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { SignalType } from '../types';

interface SignalTypeBadgeProps {
  signalType: SignalType;
}

export const SignalTypeBadge = ({ signalType }: SignalTypeBadgeProps) => {
  const { t } = useTranslation();

  const isSelf = signalType === 'self';

  return (
    <Chip
      label={t(`ideas.signal.${signalType}`)}
      size="small"
      aria-label={`Signal type: ${signalType}`}
      sx={{
        borderRadius: '6px',
        fontWeight: 600,
        fontSize: '0.6875rem',
        height: 22,
        backgroundColor: isSelf
          ? alpha(COLORS.red, 0.12)
          : alpha(COLORS.cyan, 0.12),
        color: isSelf
          ? 'primary.main'
          : 'secondary.main',
      }}
    />
  );
};
