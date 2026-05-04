import { Button } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import { FLOW_TARGETS, type FlowTarget } from './constants';
import { DURATION, EASING } from '../../style/constants';

// ── Props ──────────────────────────────────────────────────────────
interface BulkFlowButtonProps {
  target: FlowTarget;
  label: string;
  count?: number;
  onClick: () => void;
  disabled?: boolean;
}

// ── Appear animation ───────────────────────────────────────────────
const appearIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// ── Styled root ────────────────────────────────────────────────────
const StyledButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'targetColor',
})<{ targetColor: string }>(({ theme, targetColor }) => ({
  width: '100%',
  height: theme.spacing(4),
  borderRadius: theme.shape.borderRadius,
  borderColor: targetColor,
  color: targetColor,
  animation: `${appearIn} ${DURATION.default}ms ${EASING.enter}`,
  transition: [
    `background-color ${DURATION.fast}ms ${EASING.standard}`,
    `box-shadow ${DURATION.fast}ms ${EASING.standard}`,
    `border-color ${DURATION.fast}ms ${EASING.standard}`,
  ].join(', '),
  '&:hover': {
    borderColor: targetColor,
    backgroundColor: alpha(targetColor, 0.10),
    boxShadow: `0 0 12px ${alpha(targetColor, 0.15)}`,
  },
  '&.Mui-disabled': {
    borderColor: alpha(targetColor, 0.3),
    color: alpha(targetColor, 0.4),
  },
  '& .MuiButton-endIcon': {
    '& > *:first-of-type': {
      fontSize: 16,
    },
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha(targetColor, 0.08),
      boxShadow: `0 0 12px ${alpha(targetColor, 0.10)}`,
    },
  }),
}));

// ── Component ──────────────────────────────────────────────────────
const BulkFlowButton = ({
  target,
  label,
  count,
  onClick,
  disabled = false,
}: BulkFlowButtonProps) => {
  const config = FLOW_TARGETS[target];
  const Icon = config.icon;
  const displayLabel = count != null ? `${label} (${count})` : label;

  return (
    <StyledButton
      targetColor={config.color}
      variant="outlined"
      size="small"
      endIcon={<Icon />}
      onClick={onClick}
      disabled={disabled}
      aria-label={displayLabel}
    >
      {displayLabel}
    </StyledButton>
  );
};

export default BulkFlowButton;
