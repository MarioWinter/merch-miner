import { Box, Button, IconButton } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { BOTTOM_TOOLBAR_HEIGHT } from './BottomToolbar.styles';

export const PROMPT_BAR_COLLAPSED_HEIGHT = 48;
export const PROMPT_BAR_EXPANDED_HEIGHT = 360;

// -----------------------------------------------------------------
// Root container — handles slide-up animation
// -----------------------------------------------------------------

export const BarRoot = styled(Box, {
  shouldForwardProp: (p) => p !== '$expanded',
})<{ $expanded: boolean }>(({ theme, $expanded }) => ({
  position: 'absolute',
  bottom: BOTTOM_TOOLBAR_HEIGHT + 8, // sits above BottomToolbar with 8px gap
  left: 16,
  right: 16,
  zIndex: 10,
  background: 'rgba(11,39,49, 0.92)',
  backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  overflow: 'hidden',
  transition: `height ${DURATION.default}ms ${EASING.standard}, box-shadow ${DURATION.default}ms ${EASING.standard}`,
  height: $expanded ? PROMPT_BAR_EXPANDED_HEIGHT : PROMPT_BAR_COLLAPSED_HEIGHT,
  boxShadow: $expanded ? '0 8px 32px rgba(0,0,0,0.40)' : 'none',
  ...theme.applyStyles('light', {
    background: 'rgba(255,255,255, 0.92)',
    border: '1px solid rgba(7,30,38,0.10)',
    boxShadow: $expanded ? '0 8px 24px rgba(7,30,38,0.12)' : 'none',
  }),
}));

// -----------------------------------------------------------------
// Collapsed bar — single-line clickable input
// -----------------------------------------------------------------

export const CollapsedRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  height: PROMPT_BAR_COLLAPSED_HEIGHT,
  padding: `0 ${theme.spacing(2)}`,
  cursor: 'pointer',
  gap: theme.spacing(1),
  '&:hover': {
    backgroundColor: alpha(COLORS.red, 0.04),
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      backgroundColor: alpha(COLORS.red, 0.03),
    },
  }),
}));

export const CollapsedPlaceholder = styled('span')(({ theme }) => ({
  flex: 1,
  fontSize: '0.875rem',
  fontWeight: 400,
  color: theme.vars.palette.text.disabled,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  userSelect: 'none',
}));

// -----------------------------------------------------------------
// Expanded header row
// -----------------------------------------------------------------

export const ExpandedHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(1.5)} ${theme.spacing(2)} 0`,
}));

export const CloseButton = styled(IconButton)(({ theme }) => ({
  width: 28,
  height: 28,
  borderRadius: 8,
  color: theme.vars.palette.text.secondary,
  '&:hover': {
    color: theme.vars.palette.text.primary,
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

// -----------------------------------------------------------------
// Expanded content (scrollable inner area)
// -----------------------------------------------------------------

export const ExpandedContent = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  padding: `${theme.spacing(1)} ${theme.spacing(2)} ${theme.spacing(2)}`,
  overflowY: 'auto',
  maxHeight: PROMPT_BAR_EXPANDED_HEIGHT - 48, // minus header
}));

// -----------------------------------------------------------------
// Thumbnails row
// -----------------------------------------------------------------

export const ThumbnailRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  flexWrap: 'nowrap',
  overflowX: 'auto',
  minHeight: 48,
  '&::-webkit-scrollbar': { height: 4 },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: alpha(COLORS.snowMuted, 0.3),
    borderRadius: 2,
  },
}));

export const Thumbnail = styled(Box, {
  shouldForwardProp: (p) => p !== '$isResult',
})<{ $isResult?: boolean }>(({ theme, $isResult }) => ({
  width: 48,
  height: 48,
  borderRadius: 6,
  border: `2px solid ${$isResult ? theme.vars.palette.secondary.main : theme.vars.palette.divider}`,
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: COLORS.inkElevated,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
}));

export const ThumbnailArrow = styled('span')(({ theme }) => ({
  fontSize: '1rem',
  color: theme.vars.palette.text.secondary,
  flexShrink: 0,
  userSelect: 'none',
}));

// -----------------------------------------------------------------
// Controls row
// -----------------------------------------------------------------

export const ControlsRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  flexWrap: 'wrap',
}));

// -----------------------------------------------------------------
// Generate button (AI gradient)
// -----------------------------------------------------------------

export const GenerateButton = styled(Button)(({ theme }) => ({
  background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  color: theme.vars.palette.common.white,
  fontWeight: 600,
  minWidth: 140,
  height: 40,
  borderRadius: 8,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    background: `linear-gradient(135deg, ${theme.vars.palette.primary.dark} 0%, ${theme.vars.palette.primary.main} 100%)`,
    boxShadow: `0 0 16px ${alpha(COLORS.red, 0.35)}`,
  },
  '&.Mui-disabled': {
    opacity: 0.5,
    background: `linear-gradient(135deg, ${theme.vars.palette.primary.main} 0%, ${theme.vars.palette.primary.dark} 100%)`,
  },
}));
