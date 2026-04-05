import { Box, Button, Typography, CircularProgress, Alert, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTranslation } from 'react-i18next';
import type { CloudFile, CloudFolder } from '../hooks/useGoogleDrive';
import { CloudFolderBrowser } from './CloudFolderBrowser';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const TabRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  minHeight: 360,
}));

const CenterBox = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  flex: 1,
  minHeight: 200,
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface CloudProviderTabProps {
  provider: 'gdrive' | 'onedrive';
  isConfigured: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  accountEmail: string | null;
  error: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  listFolders: (parentId?: string) => Promise<CloudFolder[]>;
  listImages: (folderId: string, basePath?: string) => Promise<CloudFile[]>;
  uploadFile: (file: File, folderId: string) => Promise<string>;
  onUseForAi: (files: CloudFile[]) => void;
  onDownload: (files: CloudFile[]) => void;
  batchFileNames?: string[];
  getBatchFile?: (name: string) => File | null;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const CloudProviderTab = ({
  isConfigured,
  isConnected,
  isConnecting,
  accountEmail,
  error,
  onConnect,
  onDisconnect,
  listFolders,
  listImages,
  uploadFile,
  onUseForAi,
  onDownload,
  batchFileNames,
  getBatchFile,
}: CloudProviderTabProps) => {
  const { t } = useTranslation();

  // --- Not configured ---
  if (!isConfigured) {
    return (
      <TabRoot>
        <CenterBox>
          <SettingsIcon sx={{ fontSize: 48 }} color="disabled" />
          <Typography variant="body1" color="text.secondary">
            {t('design.cloud.notConfigured')}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            {t('design.cloud.notConfiguredHint')}
          </Typography>
        </CenterBox>
      </TabRoot>
    );
  }

  // --- Not connected ---
  if (!isConnected) {
    return (
      <TabRoot>
        <CenterBox>
          <CloudOffIcon sx={{ fontSize: 48 }} color="disabled" />
          <Typography variant="body1" color="text.secondary">
            {t('design.cloud.disconnectedHint')}
          </Typography>
          {error && <Alert severity="error" sx={{ maxWidth: 400 }}>{error}</Alert>}
          <Button
            variant="outlined"
            color="secondary"
            onClick={onConnect}
            disabled={isConnecting}
            startIcon={isConnecting ? <CircularProgress size={16} /> : undefined}
          >
            {isConnecting ? t('design.cloud.connecting') : t('design.cloud.connect')}
          </Button>
        </CenterBox>
      </TabRoot>
    );
  }

  // --- Connected ---
  return (
    <TabRoot>
      {/* Account info + disconnect */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="body2" color="text.secondary">
            {t('design.cloud.connected')}
          </Typography>
          {accountEmail && (
            <Typography variant="body2" color="text.primary">
              {accountEmail}
            </Typography>
          )}
        </Stack>
        <Button size="small" variant="text" color="error" onClick={onDisconnect}>
          {t('design.cloud.disconnect')}
        </Button>
      </Stack>

      {/* Folder browser + file table + upload */}
      <CloudFolderBrowser
        listFolders={listFolders}
        listImages={listImages}
        uploadFile={uploadFile}
        onUseForAi={onUseForAi}
        onDownload={onDownload}
        batchFileNames={batchFileNames}
        getBatchFile={getBatchFile}
      />
    </TabRoot>
  );
};
