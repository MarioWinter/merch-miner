import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
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
      sx={(theme) => ({
        borderRadius: '6px',
        fontWeight: 600,
        fontSize: '0.6875rem',
        height: 22,
        backgroundColor: isSelf
          ? 'rgba(255,90,79,0.12)'
          : 'rgba(0,200,215,0.12)',
        color: isSelf
          ? theme.vars.palette.primary.main
          : theme.vars.palette.secondary.main,
      })}
    />
  );
};
