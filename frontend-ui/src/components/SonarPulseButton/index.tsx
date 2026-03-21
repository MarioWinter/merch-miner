import { ButtonBase, Stack, Typography } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import HardwareIcon from '@mui/icons-material/Hardware';
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

const sonarSweep = keyframes`
  0%   { --angle: 0deg; }
  100% { --angle: 360deg; }
`;

const labelPulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
`;

const spinnerRing = keyframes`
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

type ButtonState = 'idle' | 'busy' | 'failed' | 'cancel';

const SonarRoot = styled(ButtonBase, {
  shouldForwardProp: (p) => p !== 'state',
})<{ state: ButtonState }>(({ theme, state }) => {
  const cyan = theme.vars.palette.secondary.main;
  const coral = theme.vars.palette.primary.main;
  const errorColor = theme.vars.palette.error.main;
  const paper = theme.vars.palette.background.paper;

  const speed = state === 'busy' ? '2s' : '4s';

  return {
    '@property --angle': {
      syntax: '"<angle>"',
      initialValue: '0deg',
      inherits: 'false',
    },
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    borderRadius: 10,
    background: paper,
    color: state === 'cancel' ? errorColor : theme.vars.palette.text.primary,
    overflow: 'hidden',
    isolation: 'isolate',
    cursor: 'pointer',
    transition: `all 200ms ${EASING.standard}`,

    // Animated border via pseudo-element
    '&::before': {
      content: '""',
      position: 'absolute',
      inset: 0,
      borderRadius: 'inherit',
      padding: 1,
      background:
        state === 'failed'
          ? alpha(theme.palette.primary.main, 0.4)
          : state === 'cancel'
            ? errorColor
            : `conic-gradient(from var(--angle), ${cyan}, ${coral}, transparent 40%, transparent)`,
      mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      maskComposite: 'exclude',
      WebkitMaskComposite: 'xor',
      animation:
        state === 'idle' || state === 'busy'
          ? `${sonarSweep} ${speed} linear infinite`
          : 'none',
      pointerEvents: 'none',
    },

    '&:hover':
      state === 'idle'
        ? {
            '&::before': {
              animationDuration: '1.5s',
            },
            boxShadow: `0 0 16px ${alpha(theme.palette.secondary.main, 0.25)}`,
            '& .sonar-icon': {
              transform: 'rotate(15deg)',
            },
          }
        : {},
  };
});

const Spinner = styled('span')(({ theme }) => ({
  display: 'inline-block',
  width: 18,
  height: 18,
  border: `2px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
  borderTopColor: theme.vars.palette.secondary.main,
  borderRadius: '50%',
  animation: `${spinnerRing} 0.8s linear infinite`,
  flexShrink: 0,
}));

const IconWrap = styled('span')({
  display: 'inline-flex',
  transition: `transform 150ms ${EASING.standard}`,
  flexShrink: 0,
});

const PulsingLabel = styled(Typography)({
  animation: `${labelPulse} 1.5s ease-in-out infinite`,
});

export const SonarPulseButton = ({
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
    if (isBusy) return <Spinner />;
    if (isFailed)
      return (
        <IconWrap>
          <ReplayIcon sx={{ fontSize: 20 }} />
        </IconWrap>
      );
    return (
      <IconWrap className="sonar-icon">
        <HardwareIcon sx={{ fontSize: 20 }} />
      </IconWrap>
    );
  };

  const renderLabel = () => {
    if (isBusy) {
      return (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <PulsingLabel variant="button">{t('research.running')}</PulsingLabel>
          <StopCircleIcon
            sx={{ fontSize: 16, color: 'error.main', ml: 0.5 }}
          />
        </Stack>
      );
    }
    if (isFailed) return <Typography variant="button">{t('research.error.retryButton')}</Typography>;
    return <Typography variant="button">{t('research.triggerButton')}</Typography>;
  };

  return (
    <SonarRoot
      state={isBusy ? 'cancel' : state}
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
    </SonarRoot>
  );
};
