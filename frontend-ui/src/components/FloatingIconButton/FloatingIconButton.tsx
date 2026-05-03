import { type ReactNode } from 'react';
import { IconButton, type SxProps, type Theme } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import { COLORS } from '@/style/constants';

interface FloatingIconButtonProps {
  /** Icon (or any node) rendered inside the pill. */
  children: ReactNode;
  onClick: () => void;
  /** Used for both `aria-label` and `title` (tooltip). */
  ariaLabel: string;
  /** When false the component renders nothing. Default: true. */
  visible?: boolean;
  /**
   * Positioning + per-instance overrides. The component is intentionally
   * unpositioned by default; consumers decide where the button lives
   * (e.g. `position: 'absolute', bottom: 16, right: 16`).
   */
  sx?: SxProps<Theme>;
}

const fadeInUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(8px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

/**
 * Floating glass-pill icon button. Shared visual language used for the
 * chat "jump to latest" affordance and the legal-page back affordance.
 *
 * Color-scheme note: `theme.palette.background.*` returns the *light* values
 * regardless of the active scheme inside `styled()` callbacks. We therefore
 * use raw COLORS tokens via `applyStyles('dark', …)` so the surface stays
 * dark in dark mode (recurring bug — see memory `feedback_color_bug.md`).
 */
const StyledFloatingButton = styled(IconButton)(({ theme }) => ({
  zIndex: 2,
  width: 40,
  height: 40,
  color: COLORS.ink,
  border: `1px solid ${alpha(COLORS.ink, 0.18)}`,
  background: `linear-gradient(180deg, ${COLORS.ashTooltip} 0%, ${COLORS.ash} 100%)`,
  backdropFilter: 'blur(12px) saturate(1.2)',
  WebkitBackdropFilter: 'blur(12px) saturate(1.2)',
  boxShadow:
    `0 4px 14px ${alpha(COLORS.ink, 0.3)}, ` +
    `inset 0 1px 0 ${alpha('#fff', 0.6)}`,
  transition:
    'transform 180ms ease, box-shadow 180ms ease, ' +
    'border-color 180ms ease, color 180ms ease, background 180ms ease',
  animation: `${fadeInUp} 220ms cubic-bezier(.22,.61,.36,1)`,
  '& svg': {
    transition: 'transform 180ms ease',
  },
  '&:hover': {
    transform: 'translateY(-2px)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  ...theme.applyStyles('dark', {
    color: COLORS.snow,
    border: `1px solid ${alpha(COLORS.snow, 0.16)}`,
    background: `linear-gradient(180deg, ${alpha(
      COLORS.inkElevated,
      0.95,
    )} 0%, ${alpha(COLORS.inkPaper, 0.95)} 100%)`,
    boxShadow:
      `0 4px 14px ${alpha('#000', 0.55)}, ` +
      `inset 0 1px 0 ${alpha(COLORS.snow, 0.06)}`,
    '&:hover': {
      transform: 'translateY(-2px)',
      color: COLORS.red,
      borderColor: alpha(COLORS.red, 0.5),
      boxShadow:
        `0 8px 22px ${alpha('#000', 0.65)}, ` +
        `0 0 0 3px ${alpha(COLORS.red, 0.18)}, ` +
        `inset 0 1px 0 ${alpha(COLORS.snow, 0.08)}`,
    },
  }),
}));

const FloatingIconButton = ({
  children,
  onClick,
  ariaLabel,
  visible = true,
  sx,
}: FloatingIconButtonProps) => {
  if (!visible) return null;
  return (
    <StyledFloatingButton
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      sx={sx}
    >
      {children}
    </StyledFloatingButton>
  );
};

export default FloatingIconButton;
