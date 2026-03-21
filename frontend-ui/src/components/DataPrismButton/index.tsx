import { ButtonBase, Typography } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
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

const accentSweep = keyframes`
  0%   { background-position: 0% 100%; }
  50%  { background-position: 0% 0%; }
  100% { background-position: 0% 100%; }
`;

const labelPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.8; }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 4px 20px rgba(0, 200, 215, 0.15); }
  50%      { box-shadow: 0 4px 28px rgba(0, 200, 215, 0.3); }
`;

type ButtonState = 'idle' | 'busy' | 'failed';

const PrismRoot = styled(ButtonBase, {
  shouldForwardProp: (p) => p !== 'state',
})<{ state: ButtonState }>(({ theme, state }) => {
  const cyan = theme.vars.palette.secondary.main;
  const coral = theme.vars.palette.primary.main;

  return {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px 10px 16px',
    borderRadius: 10,
    background:
      state === 'busy'
        ? alpha(theme.palette.secondary.main, 0.06)
        : theme.vars.palette.background.paper,
    ...(state === 'busy' && {
      backdropFilter: 'blur(12px)',
    }),
    border: `1px solid ${alpha(
      state === 'failed'
        ? theme.palette.primary.main
        : theme.palette.secondary.main,
      state === 'idle' ? 0.15 : 0.25,
    )}`,
    color: theme.vars.palette.text.primary,
    cursor: 'pointer',
    overflow: 'hidden',
    isolation: 'isolate',
    transition: `all 300ms ${EASING.standard}`,

    ...(state === 'busy' && {
      animation: `${glowPulse} 3s ease-in-out infinite`,
    }),

    // Left accent bar
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      width: 3,
      borderRadius: '0 2px 2px 0',
      transition: `all 300ms ${EASING.standard}`,
      ...(state === 'idle' && {
        top: '15%',
        height: '70%',
        background: cyan,
      }),
      ...(state === 'busy' && {
        top: 0,
        height: '100%',
        backgroundImage: `linear-gradient(0deg, transparent, ${cyan}, transparent)`,
        backgroundSize: '100% 200%',
        animation: `${accentSweep} 1.5s ease-in-out infinite`,
      }),
      ...(state === 'failed' && {
        top: '15%',
        height: '70%',
        background: coral,
      }),
    },

    '&:hover':
      state === 'idle'
        ? {
            background: alpha(theme.palette.secondary.main, 0.06),
            boxShadow: `0 4px 16px ${alpha(theme.palette.secondary.main, 0.2)}`,
            // Bar flows to bottom underline
            '&::before': {
              top: 'auto',
              bottom: 0,
              left: 0,
              width: '100%',
              height: 3,
              borderRadius: '2px 2px 0 0',
            },
            '& .prism-icon': {
              transform: 'scale(1.1)',
            },
          }
        : {},
  };
});

const IconWrap = styled('span')({
  display: 'inline-flex',
  flexShrink: 0,
  transition: `transform 200ms ${EASING.standard}`,
});

const PulsingLabel = styled(Typography)({
  animation: `${labelPulse} 1.5s ease-in-out infinite`,
});

export const DataPrismButton = ({
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
        <>
          <IconWrap className="prism-icon">
            <AutoAwesomeIcon
              sx={{ fontSize: 20, color: 'secondary.main' }}
            />
          </IconWrap>
        </>
      );
    }
    if (isFailed) {
      return (
        <IconWrap className="prism-icon">
          <ReplayIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        </IconWrap>
      );
    }
    return (
      <IconWrap className="prism-icon">
        <AutoAwesomeIcon sx={{ fontSize: 20, color: 'secondary.main' }} />
      </IconWrap>
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
    <PrismRoot
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
    </PrismRoot>
  );
};
