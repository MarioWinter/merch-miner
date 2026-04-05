import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import CloudIcon from '@mui/icons-material/Cloud';
import { useTranslation } from 'react-i18next';
import useGoogleDrive from '@/views/designs/editor/hooks/useGoogleDrive';
import useOneDrive from '@/views/designs/editor/hooks/useOneDrive';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const ProviderRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 2),
  borderRadius: theme.shape.borderRadius,
  border: '1px solid',
  borderColor: theme.vars.palette.divider,
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const CloudStorageSettings = () => {
  const { t } = useTranslation();
  const gdrive = useGoogleDrive();
  const onedrive = useOneDrive();

  const providers = [
    {
      key: 'gdrive' as const,
      icon: <GoogleIcon sx={{ fontSize: 20 }} />,
      name: t('design.cloud.googleDrive'),
      ...gdrive,
    },
    {
      key: 'onedrive' as const,
      icon: <CloudIcon sx={{ fontSize: 20 }} />,
      name: t('design.cloud.oneDrive'),
      ...onedrive,
    },
  ];

  return (
    <Stack spacing={1.5}>
      {providers.map((p) => (
        <ProviderRow key={p.key}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {p.icon}
            <Box>
              <Typography variant="body2">{p.name}</Typography>
              {p.isConnected && p.accountEmail && (
                <Typography variant="caption" color="text.secondary">
                  {p.accountEmail}
                </Typography>
              )}
            </Box>
          </Stack>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Chip
              size="small"
              label={p.isConnected ? t('design.cloud.connected') : t('design.cloud.disconnect')}
              color={p.isConnected ? 'success' : 'default'}
              variant="outlined"
            />
            {p.isConfigured ? (
              p.isConnected ? (
                <Button size="small" variant="text" color="error" onClick={p.disconnect}>
                  {t('design.cloud.disconnect')}
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  color="secondary"
                  onClick={p.connect}
                  disabled={p.isConnecting}
                  startIcon={p.isConnecting ? <CircularProgress size={14} /> : undefined}
                >
                  {p.isConnecting ? t('design.cloud.connecting') : t('design.cloud.connect')}
                </Button>
              )
            ) : (
              <Chip
                size="small"
                label={t('design.cloud.notConfigured')}
                color="warning"
                variant="outlined"
              />
            )}
          </Stack>
        </ProviderRow>
      ))}
    </Stack>
  );
};

export default CloudStorageSettings;
