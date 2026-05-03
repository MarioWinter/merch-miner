import { Box } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { COLORS, EASING, DURATION } from '@/style/constants';

interface ChevronIndicatorProps {
  onClick: () => void;
  ariaLabel: string;
}

// `--footer-offset` is set by AppLayout and reflects the currently-visible
// height of the global footer. When the footer scrolls below the fold the
// variable falls to 0 and the chevron sits flush with the viewport bottom;
// when the footer is on screen the chevron rides on top of it.
const IndicatorRoot = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 'var(--footer-offset, 0px)',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 64,
  height: 24,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center',
  borderTopLeftRadius: 12,
  borderTopRightRadius: 12,
  cursor: 'pointer',
  zIndex: theme.zIndex.speedDial - 1,
  color: theme.vars.palette.text.secondary,
  backgroundColor: alpha(COLORS.white, 0.7),
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  borderLeft: `1px solid ${theme.vars.palette.divider}`,
  borderRight: `1px solid ${theme.vars.palette.divider}`,
  opacity: 0.65,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}, background-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    opacity: 1,
    backgroundColor: alpha(COLORS.white, 0.9),
  },
  ...theme.applyStyles('dark', {
    backgroundColor: alpha(COLORS.inkPaper, 0.6),
    '&:hover': {
      opacity: 1,
      backgroundColor: alpha(COLORS.inkPaper, 0.85),
    },
  }),
}));

const ChevronIndicator = ({ onClick, ariaLabel }: ChevronIndicatorProps) => (
  <IndicatorRoot
    onClick={onClick}
    role="button"
    tabIndex={0}
    aria-label={ariaLabel}
    onKeyDown={(e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') onClick();
    }}
  >
    <KeyboardArrowUpIcon sx={{ fontSize: 18, mb: 0.25 }} />
  </IndicatorRoot>
);

export default ChevronIndicator;
