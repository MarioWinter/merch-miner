import { Chip } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import type { NicheStatus } from '../types';

interface NicheStatusChipProps {
  status: NicheStatus;
}

type ChipVariant = 'todo' | 'inProgress' | 'complete' | 'system';

const TODO_STATUSES: NicheStatus[] = [
  'data_entry',
  'deep_research',
  'niche_with_potential',
];
const IN_PROGRESS_STATUSES: NicheStatus[] = ['to_designer', 'upload', 'start_ads'];
const COMPLETE_STATUSES: NicheStatus[] = ['pending', 'winner', 'loser'];

const getVariant = (status: NicheStatus): ChipVariant => {
  if (TODO_STATUSES.includes(status)) return 'todo';
  if (IN_PROGRESS_STATUSES.includes(status)) return 'inProgress';
  if (COMPLETE_STATUSES.includes(status)) return 'complete';
  return 'system';
};

interface StyledChipProps {
  chipvariant: ChipVariant;
}

const StyledStatusChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== 'chipvariant',
})<StyledChipProps>(({ theme, chipvariant }) => {
  const variantStyles: Record<ChipVariant, object> = {
    todo: {
      backgroundColor: alpha(COLORS.infoDk, 0.10),
      color: theme.vars.palette.info.main,
      borderColor: alpha(COLORS.infoDk, 0.20),
    },
    inProgress: {
      backgroundColor: alpha(COLORS.warningDk, 0.12),
      color: theme.vars.palette.warning.main,
      borderColor: alpha(COLORS.warningDk, 0.25),
    },
    complete: {
      backgroundColor: alpha(COLORS.successDk, 0.12),
      color: theme.vars.palette.success.main,
      borderColor: alpha(COLORS.successDk, 0.25),
    },
    system: {
      backgroundColor: alpha(COLORS.snowMuted, 0.10),
      color: theme.vars.palette.text.secondary,
      borderColor: alpha(COLORS.snowMuted, 0.20),
    },
  };

  return {
    height: 22,
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    borderRadius: 6,
    border: '1px solid',
    ...variantStyles[chipvariant],
    '& .MuiChip-label': {
      paddingLeft: 8,
      paddingRight: 8,
    },
  };
});

export const NicheStatusChip = ({ status }: NicheStatusChipProps) => {
  const { t } = useTranslation();
  const variant = getVariant(status);

  return (
    <StyledStatusChip
      label={t(`niches.status.${status}`, { defaultValue: status })}
      chipvariant={variant}
      size="small"
    />
  );
};
