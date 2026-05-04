import { Box, Button, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import FolderOffOutlinedIcon from '@mui/icons-material/FolderOffOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConnectionStatus = 'not_connected' | 'loading' | 'empty' | 'not_configured';

interface CloudConnectionStateProps {
  status: ConnectionStatus;
  providerName: string;
  onConnect?: () => void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const CenterContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8, 0),
  gap: theme.spacing(1.5),
}));

const SkeletonGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: theme.spacing(2.5),
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CloudConnectionState = ({
  status,
  providerName,
  onConnect,
}: CloudConnectionStateProps) => {
  const { t } = useTranslation();

  if (status === 'loading') {
    return (
      <SkeletonGrid>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            sx={{
              aspectRatio: '1 / 1',
              borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 1.5}px`,
            }}
          />
        ))}
      </SkeletonGrid>
    );
  }

  if (status === 'not_configured') {
    return (
      <CenterContainer>
        <CloudOffOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography variant="h5" color="text.secondary">
          {t('publish.cloud.notConfigured', {
            defaultValue: '{{provider}} not configured',
            provider: providerName,
          })}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('publish.cloud.configureHint', {
            defaultValue: 'Set up cloud credentials in Settings to enable this feature.',
          })}
        </Typography>
      </CenterContainer>
    );
  }

  if (status === 'not_connected') {
    return (
      <CenterContainer>
        <CloudOffOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography variant="h5" color="text.secondary">
          {t('publish.cloud.connectTitle', {
            defaultValue: 'Connect {{provider}}',
            provider: providerName,
          })}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('publish.cloud.connectDescription', {
            defaultValue: 'Sign in to browse your cloud files.',
          })}
        </Typography>
        {onConnect && (
          <Button
            variant="outlined"
            onClick={onConnect}
            sx={{ mt: 1, color: COLORS.cyan, borderColor: COLORS.cyan }}
          >
            {t('publish.cloud.connect', { defaultValue: 'Connect' })}
          </Button>
        )}
      </CenterContainer>
    );
  }

  // status === 'empty'
  return (
    <CenterContainer>
      <FolderOffOutlinedIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
      <Typography variant="body2" color="text.secondary">
        {t('publish.cloud.emptyFolder', { defaultValue: 'No images in this folder' })}
      </Typography>
    </CenterContainer>
  );
};

export default CloudConnectionState;
