/**
 * Left-edge layout toggle for MultiPurposeDrawer — mirror of the sidebar
 * collapse button. Flips `chatBar.drawerLayout` between `overlap` (default,
 * drawer floats on content) and `sideBySide` (main column gets a matching
 * right margin). Desktop-only.
 */
import { Box, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { styled, alpha, useTheme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { toggleDrawerLayout } from '@/store/chatBarSlice';
import { COLORS, EASING, DURATION } from '@/style/constants';

const ToggleWrap = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$visible',
})<{ $visible: boolean }>(({ theme, $visible }) => ({
  position: 'absolute',
  top: 80,
  left: -24,
  width: 48,
  height: 48,
  zIndex: 1,
  borderRadius: '50%',
  backgroundColor: COLORS.ashDefault,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: $visible ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  ...theme.applyStyles('dark', {
    backgroundColor: COLORS.ink,
  }),
  // Cutout ring mirrors sidebar; clip the right half so the arc hugs the drawer edge.
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid',
    borderColor: theme.vars.palette.divider,
    clipPath: 'inset(-1px -1px -1px 50%)',
    pointerEvents: 'none',
  },
}));

const ToggleButton = styled(IconButton)({
  width: 28,
  height: 28,
  borderRadius: '50%',
  backgroundColor: COLORS.red,
  color: COLORS.white,
  boxShadow: `0 2px 8px ${alpha(COLORS.black, 0.15)}`,
  '&:hover': {
    backgroundColor: COLORS.redDk,
  },
});

const DrawerLayoutToggle = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useAppDispatch();
  const drawerOpen = useAppSelector((s) => s.chatBar.drawerOpen);
  const drawerLayout = useAppSelector((s) => s.chatBar.drawerLayout);

  if (isMobile) return null;

  // Chevron points inward (overlap → push aside) / outward (sideBySide → re-overlap).
  const isSideBySide = drawerLayout === 'sideBySide';
  const Icon = isSideBySide ? ChevronRightIcon : ChevronLeftIcon;
  const tooltipKey = isSideBySide
    ? 'search.drawer.layoutSideBySideTooltip'
    : 'search.drawer.layoutOverlapTooltip';

  return (
    <ToggleWrap className="mpd-layout-toggle" $visible={drawerOpen}>
      <Tooltip title={t(tooltipKey)} placement="left">
        <ToggleButton
          onClick={() => dispatch(toggleDrawerLayout())}
          size="small"
          aria-label={t('search.drawer.layoutToggleAriaLabel')}
          data-testid="mpd-layout-toggle"
        >
          <Icon sx={{ fontSize: 18 }} />
        </ToggleButton>
      </Tooltip>
    </ToggleWrap>
  );
};

export default DrawerLayoutToggle;
