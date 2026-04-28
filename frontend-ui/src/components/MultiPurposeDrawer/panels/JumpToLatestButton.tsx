import { IconButton } from '@mui/material';
import { styled, alpha, keyframes } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

interface JumpToLatestButtonProps {
  onClick: () => void;
  visible: boolean;
}

const fadeInUp = keyframes({
  '0%': { opacity: 0, transform: 'translateY(8px)' },
  '100%': { opacity: 1, transform: 'translateY(0)' },
});

/**
 * Floating "jump to latest" pill anchored bottom-right of the message list.
 *
 * Color-scheme note: `theme.palette.background.*` returns the *light* values
 * regardless of the active scheme inside `styled()` callbacks. We therefore
 * use raw COLORS tokens via `applyStyles('dark', …)` so the surface stays
 * dark in dark mode (recurring bug — see memory `feedback_color_bug.md`).
 */
const FloatingIconButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  bottom: theme.spacing(2),
  right: theme.spacing(2),
  zIndex: 2,
  width: 40,
  height: 40,
  // Light-mode default — white-ish surface + ink text + subtle border.
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
  '&:hover svg': {
    transform: 'translateY(2px)',
  },
  '&:active': {
    transform: 'translateY(0)',
  },
  // Dark mode — ink-colored glass surface that visually belongs in the panel.
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

const JumpToLatestButton = ({ onClick, visible }: JumpToLatestButtonProps) => {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <FloatingIconButton
      onClick={onClick}
      aria-label={t('search.scroll.jumpToLatest')}
      title={t('search.scroll.jumpToLatest')}
    >
      <KeyboardArrowDownIcon sx={{ fontSize: 22 }} />
    </FloatingIconButton>
  );
};

export default JumpToLatestButton;
