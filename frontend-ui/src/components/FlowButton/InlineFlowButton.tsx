import { IconButton, Tooltip } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { FLOW_TARGETS, type FlowTarget } from './constants';
import { DURATION, EASING } from '../../style/constants';

// ── Props ──────────────────────────────────────────────────────────
interface InlineFlowButtonProps {
  target: FlowTarget;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
}

// ── Styled root ────────────────────────────────────────────────────
const StyledIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'targetColor',
})<{ targetColor: string }>(({ theme, targetColor }) => ({
  width: theme.spacing(3.5),
  height: theme.spacing(3.5),
  borderRadius: theme.shape.borderRadius * 0.75,
  backgroundColor: 'transparent',
  color: theme.vars.palette.text.disabled,
  transition: [
    `color ${DURATION.fast}ms ${EASING.standard}`,
    `background-color ${DURATION.fast}ms ${EASING.standard}`,
    `transform ${DURATION.fast}ms ${EASING.standard}`,
  ].join(', '),
  '&:hover': {
    backgroundColor: alpha(targetColor, 0.12),
    color: targetColor,
    transform: 'translateX(2px)',
  },
  '&.Mui-disabled': {
    color: theme.vars.palette.text.disabled,
    opacity: 0.4,
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha(targetColor, 0.10),
    },
  }),
}));

// ── Component ──────────────────────────────────────────────────────
const InlineFlowButton = ({
  target,
  tooltip,
  onClick,
  disabled = false,
}: InlineFlowButtonProps) => {
  const config = FLOW_TARGETS[target];
  const Icon = config.icon;

  return (
    <Tooltip title={tooltip} placement="top" arrow>
      <span>
        <StyledIconButton
          targetColor={config.color}
          onClick={onClick}
          disabled={disabled}
          size="small"
          aria-label={tooltip}
        >
          <Icon sx={{ fontSize: 16 }} />
        </StyledIconButton>
      </span>
    </Tooltip>
  );
};

export default InlineFlowButton;
