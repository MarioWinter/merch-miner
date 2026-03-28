import React, { useState } from 'react';
import { Box, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { Outlet } from 'react-router-dom';
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
  minHeight: 'calc(100vh - 56px)',
  padding: theme.spacing(3),
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

const AppLayout = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'));
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
        minHeight: '100vh',
        bgcolor: 'background.default',
        '--sidebar-w': `${borderSidebarW}px`,
      } as object}
    >
      <Topbar />

      <Sidebar collapsed={collapsed} onToggle={handleToggle} onHoverChange={setHovered} />

      <MainContent component="main" $marginLeft={`${sidebarWidth}px`}>
        <Outlet />
      </MainContent>

      <FloatingChatBar />
      <MultiPurposeDrawer />
    </Box>
  );
};

export default AppLayout;
