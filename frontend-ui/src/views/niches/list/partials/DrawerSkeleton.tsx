import { Skeleton, Stack } from '@mui/material';

export const DrawerSkeleton = () => (
  <Stack spacing={2}>
    <Skeleton variant="rectangular" animation="wave" height={40} width="100%" sx={{ borderRadius: '8px' }} />
    <Skeleton variant="rectangular" animation="wave" height={80} width="100%" sx={{ borderRadius: '8px' }} />
    <Skeleton variant="rectangular" animation="wave" height={40} width="60%" sx={{ borderRadius: '8px' }} />
    <Skeleton variant="rectangular" animation="wave" height={40} width="50%" sx={{ borderRadius: '8px' }} />
    <Skeleton variant="rectangular" animation="wave" height={120} width="100%" sx={{ borderRadius: '12px' }} />
  </Stack>
);
