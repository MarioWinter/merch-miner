import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

export default function SettingsLayout() {
  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Outlet />
    </Box>
  );
}
