import { ButtonBase, Typography } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import WhatshotIcon from '@mui/icons-material/Whatshot';
import ReplayIcon from '@mui/icons-material/Replay';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import { useTranslation } from 'react-i18next';
import { EASING } from '@/style/constants';

interface DrillButtonProps {
  status: 'pending' | 'running' | 'completed' | 'failed' | null;
  isPolling: boolean;
  onClick: () => void;
  onCancel: () => void;
}

const shimmerSweep = keyframes`
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
`;

const iconPulse = keyframes`
  0%, 100% { transform: scale(1); opacity: 1; }
  50%      { transform: scale(1.15); opacity: 0.8; }
`;

const labelPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
`;

type ButtonState = 'idle' | 'busy' | 'failed';

const MagmaRoot = styled(ButtonBase, {
  shouldForwardProp: (p) => p !== 'state',
})<{ state: ButtonState }>(({ theme, state }) => {
  const coral = theme.vars.palette.primary.main;
  const coralDark = theme.vars.palette.primary.dark;
  const bg = theme.vars.palette.background.paper;
  const warning = theme.vars.palette.warning.main;

  const bgPosition =
    state === 'busy' ? '0%' : state === 'failed' ? '80%' : '80%';
  const bottomLine =
    state === 'failed' ? warning : `${coral}`;

  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    borderRadius: 10,
    background: `linear-gradient(90deg, ${coralDark} 0%, ${coral} 40%, ${bg} 60%)`,
    backgroundSize: '250% 100%',
    backgroundPosition: bgPosition,
    color:
      state === 'busy'
        ? '#FFFFFF'
        : theme.vars.palette.text.primary,
    cursor: 'pointer',
    overflow: 'hidden',
    isolation: 'isolate',
    borderBottom: `2px solid transparent`,
    borderImage: `linear-gradient(90deg, ${bottomLine}, transparent) 1`,
    transition: `background-position 400ms ${EASING.standard}, color 200ms ${EASING.standard}`,

    // Shimmer overlay for running state
    '&::after':
      state === 'busy'
        ? {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.white, 0.08)} 50%, transparent 100%)`,
            animation: `${shimmerSweep} 2s ease-in-out infinite`,
            pointerEvents: 'none',
          }
        : { content: 'none' },

    '&:hover':
      state === 'idle'
        ? {
            backgroundPosition: '40%',
            '& .magma-icon-circle': {
              boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.5)}`,
            },
          }
        : {},
  };
});

const IconCircle = styled('span', {
  shouldForwardProp: (p) => p !== 'state',
})<{ state: ButtonState }>(({ theme, state }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: alpha(theme.palette.primary.main, 0.15),
  flexShrink: 0,
  transition: `box-shadow 200ms ${EASING.standard}`,
  ...(state === 'busy' && {
    animation: `${iconPulse} 1.5s ease-in-out infinite`,
  }),
}));

const PulsingLabel = styled(Typography)({
  animation: `${labelPulse} 1.5s ease-in-out infinite`,
});

export const MagmaCoreButton = ({
  status,
  isPolling,
  onClick,
  onCancel,
}: DrillButtonProps) => {
  const { t } = useTranslation();
  const isBusy = status === 'pending' || status === 'running' || isPolling;
  const isFailed = status === 'failed';

  const state: ButtonState = isBusy ? 'busy' : isFailed ? 'failed' : 'idle';

  const handleClick = () => {
    if (isBusy) {
      onCancel();
    } else {
      onClick();
    }
  };

  const renderIcon = () => {
    if (isBusy) {
      return (
        <IconCircle state={state} className="magma-icon-circle">
          <WhatshotIcon sx={{ fontSize: 18, color: '#FFFFFF' }} />
        </IconCircle>
      );
    }
    if (isFailed) {
      return (
        <IconCircle state={state} className="magma-icon-circle">
          <ReplayIcon sx={{ fontSize: 18 }} />
        </IconCircle>
      );
    }
    return (
      <IconCircle state={state} className="magma-icon-circle">
        <WhatshotIcon sx={{ fontSize: 18 }} />
      </IconCircle>
    );
  };

  const renderLabel = () => {
    if (isBusy) {
      return (
        <>
          <PulsingLabel variant="button" sx={{ flex: 1 }}>
            {t('research.running')}
          </PulsingLabel>
          <StopCircleIcon sx={{ fontSize: 16, color: 'error.main' }} />
        </>
      );
    }
    if (isFailed)
      return (
        <Typography variant="button">
          {t('research.error.retryButton')}
        </Typography>
      );
    return (
      <Typography variant="button">{t('research.triggerButton')}</Typography>
    );
  };

  return (
    <MagmaRoot
      state={state}
      onClick={handleClick}
      aria-label={
        isBusy
          ? t('research.stopButton')
          : isFailed
            ? t('research.error.retryButton')
            : t('research.triggerButton')
      }
    >
      {renderIcon()}
      {renderLabel()}
    </MagmaRoot>
  );
};
