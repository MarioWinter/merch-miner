import { Skeleton, Stack } from '@mui/material';
import { SettingsCard } from '../../../../components/SettingsCard';

const WorkspaceSkeleton = () => {
  return (
    <Stack spacing={3}>
      <SettingsCard>
        <Skeleton variant="text" width={200} height={28} sx={{ mb: 3 }} />
        <Skeleton variant="rounded" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" width={100} height={36} />
      </SettingsCard>
      <SettingsCard>
        <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={44} sx={{ mb: 1 }} />
        ))}
      </SettingsCard>
    </Stack>
  );
};

export default WorkspaceSkeleton;
