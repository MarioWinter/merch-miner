import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';

const SettingsLayout = () => {
  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Outlet />
    </Box>
  );
};

export default SettingsLayout;
