import React, { useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { Outlet, useLocation } from 'react-router-dom';
import Topbar from './topbar/Topbar';
import Sidebar, { COLLAPSED_WIDTH, EXPANDED_WIDTH } from './sidebar/Sidebar';
import FloatingChatBar from './FloatingChatBar';
import MultiPurposeDrawer from './MultiPurposeDrawer';
import { DURATION, EASING } from '@/style/constants';

// Styled components

interface MainContentProps {
  $marginLeft: string;
  component?: React.ElementType;
}

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$marginLeft',
})<MainContentProps>(({ theme, $marginLeft }) => ({
  flexGrow: 1,
  minWidth: 0,
  marginLeft: $marginLeft,
  marginTop: 56,
  minHeight: 'calc(100dvh - 56px)',
  padding: theme.spacing(3),
  boxSizing: 'border-box',
  transition: `margin-left ${DURATION.default}ms ${EASING.standard}`,
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

// Routes where the floating chat bar should be hidden (e.g. full-screen canvas)
const CHAT_BAR_HIDDEN_PATTERN = /^\/designs\/[^/]+$/;

const AppLayout = () => {
  const theme = useTheme();
  const location = useLocation();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
  const hideChatBar = CHAT_BAR_HIDDEN_PATTERN.test(location.pathname);
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

      <MainContent component="main" $marginLeft={`${sidebarWidth}px`}>
        <Outlet />
      </MainContent>

      {!hideChatBar && <FloatingChatBar />}
      <MultiPurposeDrawer />
    </Box>
  );
};

export default AppLayout;
