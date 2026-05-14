/**
 * MultiPurposeDrawer — left-edge layout toggle button.
 *
 * Floating round button positioned identically to `Sidebar.tsx`'s collapse
 * button, but on the OPPOSITE edge of the screen. Clicking it flips
 * `chatBar.drawerLayout` between `overlap` and `sideBySide`:
 *
 * - `overlap`  → drawer floats on top of main content (legacy behaviour).
 * - `sideBySide` → main content reserves a right padding equal to the
 *   current `drawerWidth` so the two regions sit next to each other.
 *
 * Only renders on desktop (`!isMobile`) and while the drawer is open.
 * Mirrors the sidebar's visual language (48 × 48 wrap, red 28 × 28 button,
 * cutout ring border) to keep the affordance discoverable.
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
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    border: '1px solid',
    borderColor: theme.vars.palette.divider,
    // Mirror of the sidebar ring — cut the RIGHT half so the visible arc
    // hugs the drawer's left edge.
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

  const isSideBySide = drawerLayout === 'sideBySide';
  // Same chevron semantics as the sidebar: in overlap mode the chevron
  // points INTO the drawer's left edge ("push the drawer aside"), in
  // sideBySide it points back outward ("let the drawer overlap again").
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
