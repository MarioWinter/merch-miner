/**
 * PROJ-30 T2.2 — Hamburger menu for `<400px` viewports.
 *
 * Only renders when `useResponsiveLayout().isPhoneTiny` is true. Tapping the
 * IconButton opens a SwipeableDrawer (left anchor, 280px wide) containing the
 * existing <Sidebar> component forced into the `mobile` variant. The drawer
 * auto-closes 80ms after a route change so the user briefly sees the active
 * state flip before slide-out (design Section 1 — Auto-close EC-5).
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IconButton, SwipeableDrawer, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import { useTranslation } from 'react-i18next';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import Sidebar from '@/components/sidebar/Sidebar';

const DRAWER_WIDTH = 280;
const AUTO_CLOSE_DELAY_MS = 80;

const HamburgerIconButton = styled(IconButton)(({ theme }) => ({
  marginLeft: theme.spacing(0.5),
  marginRight: theme.spacing(0.5),
}));

const HamburgerMenu = () => {
  const { t } = useTranslation();
  const { isPhoneTiny } = useResponsiveLayout();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Auto-close on route change (EC-5). 80ms delay so the user sees the active
  // sidebar nav item flip before slide-out.
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), AUTO_CLOSE_DELAY_MS);
    return () => window.clearTimeout(timer);
    // Intentionally key on pathname only — opening the drawer should not
    // immediately retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  if (!isPhoneTiny) return null;

  const ariaLabel = open
    ? t('responsive.hamburger.closeLabel')
    : t('responsive.hamburger.openLabel');

  return (
    <>
      <Tooltip title={ariaLabel}>
        <HamburgerIconButton
          aria-label={ariaLabel}
          aria-expanded={open ? 'true' : 'false'}
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          data-testid="topbar-hamburger"
        >
          <MenuIcon sx={{ fontSize: 24 }} />
        </HamburgerIconButton>
      </Tooltip>

      <SwipeableDrawer
        anchor="left"
        open={open}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        variant="temporary"
        slotProps={{
          paper: {
            sx: {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
            },
          },
          backdrop: {
            sx: (theme) => ({
              backgroundColor: `rgba(${theme.vars.palette.background.defaultChannel} / 0.85)`,
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }),
          },
        }}
      >
        <Sidebar
          variant="mobile"
          collapsed={false}
          onToggle={() => {}}
        />
      </SwipeableDrawer>
    </>
  );
};

export default HamburgerMenu;
