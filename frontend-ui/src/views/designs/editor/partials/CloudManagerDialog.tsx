import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Tab,
  Tabs,
  IconButton,
  Stack,
  Typography,
  Box,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import GoogleIcon from '@mui/icons-material/Google';
import CloudIcon from '@mui/icons-material/Cloud';
import { useTranslation } from 'react-i18next';
import { useGoogleDrive, useOneDrive } from '@/components/CloudStorage';
import type { CloudFile } from '@/components/CloudStorage';
import { CloudProviderTab } from './CloudProviderTab';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const TitleRow = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface CloudManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onFilesAdded: (files: File[]) => void;
  /** Batch images available for upload to cloud */
  batchFileNames?: string[];
  /** Callback to get batch files by name for upload */
  getBatchFile?: (name: string) => File | null;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

export const CloudManagerDialog = ({
  open,
  onClose,
  onFilesAdded,
  batchFileNames,
  getBatchFile,
}: CloudManagerDialogProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const gdrive = useGoogleDrive();
  const onedrive = useOneDrive();

  const handleClose = useCallback(() => {
    setFullscreen(false);
    onClose();
  }, [onClose]);

  const handleUseForAi = useCallback(async (files: CloudFile[], provider: 'gdrive' | 'onedrive') => {
    const downloadFn = provider === 'gdrive' ? gdrive.downloadFile : onedrive.downloadFile;
    const downloaded: File[] = [];
    for (const f of files) {
      try {
        const file = await downloadFn(f.id, f.name);
        downloaded.push(file);
      } catch {
        // skip failed
      }
    }
    if (downloaded.length > 0) {
      onFilesAdded(downloaded);
      handleClose();
    }
  }, [gdrive.downloadFile, onedrive.downloadFile, onFilesAdded, handleClose]);

  const handleDownload = useCallback(async (files: CloudFile[], provider: 'gdrive' | 'onedrive') => {
    const downloadFn = provider === 'gdrive' ? gdrive.downloadFile : onedrive.downloadFile;
    for (const f of files) {
      try {
        const file = await downloadFn(f.id, f.name);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // skip failed
      }
    }
  }, [gdrive.downloadFile, onedrive.downloadFile]);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullscreen}
      aria-labelledby="cloud-manager-title"
    >
      <DialogTitle id="cloud-manager-title">
        <TitleRow>
          <Typography variant="h5" component="span">
            {t('design.cloud.title')}
          </Typography>
          <Box>
            <IconButton
              size="small"
              onClick={() => setFullscreen((p) => !p)}
              aria-label={fullscreen ? t('design.cloud.exitFullscreen') : t('design.cloud.fullscreen')}
            >
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>
            <IconButton size="small" onClick={handleClose} aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Box>
        </TitleRow>
      </DialogTitle>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab
          icon={<GoogleIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t('design.cloud.googleDrive')}
        />
        <Tab
          icon={<CloudIcon sx={{ fontSize: 18 }} />}
          iconPosition="start"
          label={t('design.cloud.oneDrive')}
        />
      </Tabs>

      <DialogContent sx={{ p: 0, minHeight: 400 }}>
        {activeTab === 0 && (
          <CloudProviderTab
            provider="gdrive"
            isConfigured={gdrive.isConfigured}
            isConnected={gdrive.isConnected}
            isConnecting={gdrive.isConnecting}
            accountEmail={gdrive.accountEmail}
            error={gdrive.error}
            onConnect={gdrive.connect}
            onDisconnect={gdrive.disconnect}
            listFolders={gdrive.listFolders}
            listImages={gdrive.listImages}
            uploadFile={gdrive.uploadFile}
            onUseForAi={(files) => handleUseForAi(files, 'gdrive')}
            onDownload={(files) => handleDownload(files, 'gdrive')}
            batchFileNames={batchFileNames}
            getBatchFile={getBatchFile}
          />
        )}
        {activeTab === 1 && (
          <CloudProviderTab
            provider="onedrive"
            isConfigured={onedrive.isConfigured}
            isConnected={onedrive.isConnected}
            isConnecting={onedrive.isConnecting}
            accountEmail={onedrive.accountEmail}
            error={onedrive.error}
            onConnect={onedrive.connect}
            onDisconnect={onedrive.disconnect}
            listFolders={onedrive.listFolders}
            listImages={onedrive.listImages}
            uploadFile={onedrive.uploadFile}
            onUseForAi={(files) => handleUseForAi(files, 'onedrive')}
            onDownload={(files) => handleDownload(files, 'onedrive')}
            batchFileNames={batchFileNames}
            getBatchFile={getBatchFile}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
