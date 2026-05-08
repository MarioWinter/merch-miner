import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { useGoogleDrive, useOneDrive } from '@/components/CloudStorage';
import type { CloudFolder } from '@/components/CloudStorage';
import ProviderSwitcher from '@/views/publish/partials/cloud/ProviderSwitcher';
import type { CloudProvider } from '@/views/publish/partials/cloud/ProviderSwitcher';
import SendToCloudFolderList from '@/views/publish/partials/cloud/SendToCloudFolderList';
import CloudFolderBreadcrumbs from '@/views/publish/partials/cloud/CloudFolderBreadcrumbs';
import type { CloudPathSegment } from '@/views/publish/partials/cloud/CloudFolderBreadcrumbs';
import type { UpscaleCloudTarget } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const HeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(1.5),
}));

const BreadcrumbBar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 3),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(COLORS.ink, 0.3),
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface PickCloudFolderDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (target: UpscaleCloudTarget) => void;
  /** Optional manage-connections handler for the provider switcher menu. */
  onManageConnections?: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PickCloudFolderDialog = ({
  open,
  onClose,
  onPick,
  onManageConnections,
}: PickCloudFolderDialogProps) => {
  const { t } = useTranslation();
  const gdrive = useGoogleDrive();
  const onedrive = useOneDrive();

  // Pre-select whichever provider is connected (Drive first, OneDrive second).
  const initialProvider: CloudProvider = gdrive.isConnected
    ? 'google_drive'
    : onedrive.isConnected
      ? 'onedrive'
      : 'google_drive';

  const [provider, setProvider] = useState<CloudProvider>(initialProvider);
  const providerHook = provider === 'google_drive' ? gdrive : onedrive;

  const rootLabel = t('upscale.cloudPicker.root', { defaultValue: 'Root' });

  const [path, setPath] = useState<CloudPathSegment[]>([{ id: null, name: rootLabel }]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CloudPathSegment | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset when dialog opens or provider changes — extracted to handler
  // so the effect body stays free of direct setState calls (React 19 rule).
  const resetDialogState = useCallback(() => {
    setPath([{ id: null, name: rootLabel }]);
    setSelectedFolder(null);
    setFolders([]);
    setLoadError(null);
  }, [rootLabel]);

  useEffect(() => {
    if (!open) return;
    resetDialogState();
  }, [open, provider, resetDialogState]);

  // Fetch folders when path changes (and provider is connected).
  // Status setState calls live in a fetcher function — not the effect body.
  const loadFoldersForPath = useCallback(
    async (targetId: string | null, signal: { cancelled: boolean }) => {
      setIsLoadingFolders(true);
      setLoadError(null);
      try {
        const list = await providerHook.listFolders(targetId ?? 'root');
        if (signal.cancelled) return;
        setFolders(list);
      } catch {
        if (signal.cancelled) return;
        setLoadError(
          t('upscale.cloudPicker.loadError', { defaultValue: 'Failed to load folder' }),
        );
      } finally {
        if (!signal.cancelled) setIsLoadingFolders(false);
      }
    },
    [providerHook, t],
  );

  useEffect(() => {
    if (!open || !providerHook.isConnected) return;
    const signal = { cancelled: false };
    const targetId = path[path.length - 1]?.id ?? null;
    void loadFoldersForPath(targetId, signal);
    return () => {
      signal.cancelled = true;
    };
  }, [open, providerHook.isConnected, path, loadFoldersForPath]);

  const handleFolderClick = useCallback((folder: CloudFolder) => {
    setSelectedFolder({ id: folder.id, name: folder.name });
  }, []);

  const handleFolderDoubleClick = useCallback((folder: CloudFolder) => {
    setPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSelectedFolder({ id: folder.id, name: folder.name });
  }, []);

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const target = path[index];
      if (!target) return;
      setPath((prev) => prev.slice(0, index + 1));
      setSelectedFolder(index === 0 ? { id: null, name: rootLabel } : target);
    },
    [path, rootLabel],
  );

  const targetFolder: CloudPathSegment = useMemo(() => {
    if (selectedFolder) return selectedFolder;
    return path[path.length - 1] ?? { id: null, name: rootLabel };
  }, [selectedFolder, path, rootLabel]);

  const handleConfirm = useCallback(() => {
    onPick({
      provider,
      folder_id: targetFolder.id,
      folder_name: targetFolder.name,
    });
    onClose();
  }, [onClose, onPick, provider, targetFolder]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 2}px`,
            backgroundColor: (theme) =>
              alpha(theme.vars.palette.background.paper, 0.85),
            backdropFilter: 'blur(16px)',
            border: (theme) => `1px solid ${theme.vars.palette.divider}`,
          },
        },
      }}
    >
      <DialogTitle>
        <HeaderRow>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <CloudOutlinedIcon sx={{ fontSize: 22, color: 'secondary.main' }} />
            <Typography variant="h5">
              {t('upscale.cloudPicker.title', { defaultValue: 'Pick upscale destination' })}
            </Typography>
          </Stack>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <CloseIcon />
          </IconButton>
        </HeaderRow>
        <Box sx={{ mt: 1.5 }}>
          <ProviderSwitcher
            activeProvider={provider}
            onProviderChange={setProvider}
            googleConnected={gdrive.isConnected}
            onedriveConnected={onedrive.isConnected}
            onManageConnections={onManageConnections ?? (() => {})}
          />
        </Box>
      </DialogTitle>

      <BreadcrumbBar>
        <CloudFolderBreadcrumbs
          path={path}
          onNavigate={handleBreadcrumbClick}
          decorated
        />
      </BreadcrumbBar>

      <DialogContent sx={{ p: 0 }}>
        <SendToCloudFolderList
          folders={folders}
          selectedFolderId={selectedFolder?.id}
          isLoading={isLoadingFolders}
          loadError={loadError}
          isConnected={providerHook.isConnected}
          providerName={provider === 'google_drive' ? 'Google Drive' : 'OneDrive'}
          onFolderClick={handleFolderClick}
          onFolderDoubleClick={handleFolderDoubleClick}
        />
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          py: 1.5,
          justifyContent: 'space-between',
          borderTop: (theme) => `1px solid ${theme.vars.palette.divider}`,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {t('upscale.cloudPicker.target', {
            defaultValue: 'Save to: {{folder}}',
            folder: targetFolder.name,
          })}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} color="inherit">
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConfirm}
            disabled={!providerHook.isConnected || isLoadingFolders}
            startIcon={
              isLoadingFolders ? <CircularProgress size={14} color="inherit" /> : null
            }
          >
            {t('upscale.cloudPicker.confirm', { defaultValue: 'Use this folder' })}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default PickCloudFolderDialog;
