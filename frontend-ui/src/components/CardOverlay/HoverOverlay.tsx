import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';

/**
 * Shared hover overlay for product/design cards.
 * Shows children on parent hover with optional gradient background.
 *
 * Props:
 *   variant: 'transparent' | 'gradient' (default: 'transparent')
 *
 * Parent must be a positioned container (relative/absolute).
 * Attach hover trigger via CSS: `.parent:hover & { opacity: 1 }`
 */
const HoverOverlay = styled(Box, {
  shouldForwardProp: (p) => p !== 'variant',
})<{ variant?: 'transparent' | 'gradient' }>(({ theme, variant = 'transparent' }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  opacity: 0,
  transition: 'opacity 150ms ease',
  background:
    variant === 'gradient'
      ? `linear-gradient(to bottom, ${COLORS.ink}cc 0%, transparent 30%, transparent 50%, ${COLORS.ink}ee 100%)`
      : 'transparent',
  padding: theme.spacing(1),
  '@media (hover: none)': {
    opacity: 0.6,
  },
}));

export default HoverOverlay;
