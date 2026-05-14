import React, { useEffect, useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './topbar/Topbar';
import Sidebar, { COLLAPSED_WIDTH, EXPANDED_WIDTH } from './sidebar/Sidebar';
import MultiPurposeDrawer from './MultiPurposeDrawer';
import GlobalFooter from './GlobalFooter/GlobalFooter';
import { DURATION, EASING } from '@/style/constants';
import { useAppSelector } from '@/store/hooks';

// Styled components

interface MainContentProps {
  $marginLeft: string;
  $marginRight: string;
  component?: React.ElementType;
}

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$marginLeft' && prop !== '$marginRight',
})<MainContentProps>(({ $marginLeft, $marginRight }) => ({
  flexGrow: 1,
  minWidth: 0,
  marginLeft: $marginLeft,
  marginRight: $marginRight,
  marginTop: 56,
  minHeight: 'calc(100dvh - 56px)',
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  transition: `margin-left ${DURATION.default}ms ${EASING.standard}, margin-right ${DURATION.default}ms ${EASING.standard}`,
}));

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  padding: theme.spacing(3),
  boxSizing: 'border-box',
}));

// Component

const SIDEBAR_COLLAPSED_KEY = 'mm-sidebar-collapsed';

const getInitialCollapsed = (): boolean => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

// Routes where the global footer should be hidden — full-screen canvas pages.
const FOOTER_HIDDEN_PATTERN = /^\/designs\/[^/]+$/;

const AppLayout = () => {
  const theme = useTheme();
  const location = useLocation();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const hideFooter = FOOTER_HIDDEN_PATTERN.test(location.pathname);
  const [userCollapsed, setUserCollapsed] = useState<boolean>(getInitialCollapsed);
  const [hovered, setHovered] = useState(false);

  const collapsed = isSmallScreen || userCollapsed;

  const handleToggle = () => {
    setUserCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const borderSidebarW = collapsed && !hovered ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // sideBySide pushes the main column inward by `drawerWidth`; overlap leaves it at 0.
  const drawerOpen = useAppSelector((s) => s.chatBar.drawerOpen);
  const drawerWidth = useAppSelector((s) => s.chatBar.drawerWidth);
  const drawerLayout = useAppSelector((s) => s.chatBar.drawerLayout);
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const sideBySideActive =
    drawerOpen && drawerLayout === 'sideBySide' && !isMobile;
  const mainMarginRight = sideBySideActive ? `${drawerWidth}px` : '0px';

  // Expose the currently-visible footer height as a CSS variable so any
  // fixed-bottom UI (notifications, snackbars) can ride above it.
  useEffect(() => {
    const root = document.documentElement;
    if (hideFooter) {
      root.style.setProperty('--footer-offset', '0px');
      return;
    }
    const update = () => {
      const footer = document.querySelector<HTMLElement>(
        'footer[role="contentinfo"]',
      );
      if (!footer) {
        root.style.setProperty('--footer-offset', '0px');
        return;
      }
      const rect = footer.getBoundingClientRect();
      const visible = Math.max(0, window.innerHeight - rect.top);
      const offset = Math.min(rect.height, visible);
      root.style.setProperty('--footer-offset', `${offset}px`);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      ro.disconnect();
    };
  }, [hideFooter, location.pathname]);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100dvh',
        width: '100%',
        overflow: 'hidden',
        bgcolor: 'background.default',
        '--sidebar-w': `${borderSidebarW}px`,
      } as object}
    >
      <Topbar />

      <Sidebar collapsed={collapsed} onToggle={handleToggle} onHoverChange={setHovered} />

      <MainContent
        component="main"
        $marginLeft={`${sidebarWidth}px`}
        $marginRight={mainMarginRight}
      >
        <ContentArea>
          <Outlet />
        </ContentArea>
        {!hideFooter && <GlobalFooter />}
      </MainContent>

      <MultiPurposeDrawer />
    </Box>
  );
};

export default AppLayout;
