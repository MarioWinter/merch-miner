import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  TextField,
  Box,
  CircularProgress,
} from '@mui/material';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useImportDriveMutation } from '@/store/publishSlice';

interface CloudImportDialogProps {
  open: boolean;
  onClose: () => void;
}

const CloudImportDialog = ({ open, onClose }: CloudImportDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [provider, setProvider] = useState<'google_drive' | 'onedrive'>('google_drive');
  const [fileIds, setFileIds] = useState('');
  const [importDrive, { isLoading }] = useImportDriveMutation();

  const handleImport = async () => {
    const ids = fileIds
      .split('\n')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) return;

    try {
      await importDrive({ file_ids: ids, provider }).unwrap();
      enqueueSnackbar(
        t('publish.gallery.importSuccess', { count: ids.length }),
        { variant: 'success' },
      );
      setFileIds('');
      onClose();
    } catch {
      enqueueSnackbar(t('publish.gallery.importError'), { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CloudOutlinedIcon />
        {t('publish.gallery.importCloudTitle')}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('publish.gallery.importCloudHint')}
        </Typography>

        <ToggleButtonGroup
          value={provider}
          exclusive
          onChange={(_, val) => val && setProvider(val)}
          size="small"
          sx={{ mb: 2 }}
        >
          <ToggleButton value="google_drive">Google Drive</ToggleButton>
          <ToggleButton value="onedrive">OneDrive</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label={t('publish.gallery.fileIdsLabel')}
            placeholder={t('publish.gallery.fileIdsPlaceholder')}
            value={fileIds}
            onChange={(e) => setFileIds(e.target.value)}
            size="small"
            helperText={t('publish.gallery.fileIdsHelper')}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('publish.gallery.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={isLoading || !fileIds.trim()}
          startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {t('publish.gallery.importButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CloudImportDialog;
