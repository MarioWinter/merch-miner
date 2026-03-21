import {
  CircularProgress,
  IconButton,
  TableCell,
  Tooltip,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { COLORS } from '@/style/constants';
import type { Niche } from '../types';

interface DeepDrillCellProps {
  niche: Niche;
  width?: number | 'auto';
}

const PulsingProgress = styled(CircularProgress)(({ theme }) => ({
  '@keyframes deepDrillPulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.6 },
  },
  animation: 'deepDrillPulse 1.2s ease-in-out infinite',
  color: theme.vars.palette.secondary.main,
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none',
  },
}));

export const DeepDrillCell = ({ niche, width }: DeepDrillCellProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const w = width ?? 48;

  const isRunning =
    niche.research_status === 'running' || niche.research_status === 'pending';
  const isCompleted = niche.research_progress?.status === 'completed';
  const isFailed = niche.research_progress?.status === 'failed';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(
      `/niches/research?nicheId=${niche.id}&nicheName=${encodeURIComponent(niche.name)}`,
    );
  };

  let icon: React.ReactNode;
  let tooltip: string;

  if (isRunning) {
    icon = <PulsingProgress size={18} />;
    tooltip = t('niches.table.deepDrill.running');
  } else if (isFailed) {
    icon = <ErrorOutlineIcon sx={{ fontSize: 18 }} color="error" />;
    tooltip = t('niches.table.deepDrill.failed');
  } else if (isCompleted) {
    icon = <CheckCircleOutlineIcon sx={{ fontSize: 18 }} color="success" />;
    tooltip = t('niches.table.deepDrill.completed');
  } else {
    icon = (
      <AutoAwesomeIcon
        sx={{ fontSize: 18, color: alpha(COLORS.red, 0.6) }}
      />
    );
    tooltip = t('niches.table.deepDrill.idle');
  }

  return (
    <TableCell sx={{ width: w, textAlign: 'center', px: 0.5 }} onClick={(e) => e.stopPropagation()}>
      <Tooltip title={tooltip} placement="top">
        <IconButton
          size="small"
          onClick={handleClick}
          aria-label={tooltip}
          disabled={isRunning}
          sx={{ width: 32, height: 32, borderRadius: '8px' }}
        >
          {icon}
        </IconButton>
      </Tooltip>
    </TableCell>
  );
};
