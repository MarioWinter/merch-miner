import { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';
import Topbar from './Topbar';
import Sidebar, { COLLAPSED_WIDTH, EXPANDED_WIDTH } from './Sidebar';
import { DURATION, EASING } from '../style/constants';

const SIDEBAR_COLLAPSED_KEY = 'mm-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Topbar />

      <Sidebar collapsed={collapsed} onToggle={handleToggle} />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: `${sidebarWidth}px`,
          mt: '56px',
          minHeight: 'calc(100vh - 56px)',
          p: 3,
          bgcolor: 'background.default',
          transition: `margin-left ${DURATION.default}ms ${EASING.standard}`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
