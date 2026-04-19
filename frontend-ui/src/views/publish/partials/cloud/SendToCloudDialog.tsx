import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import { useGoogleDrive, useOneDrive } from '@/components/CloudStorage';
import type { CloudFolder } from '@/components/CloudStorage';
import type { CloudProvider } from './ProviderSwitcher';
import type { DesignAsset } from '../../types';
import SendToCloudFolderList from './SendToCloudFolderList';
import CloudFolderBreadcrumbs from './CloudFolderBreadcrumbs';
import type { CloudPathSegment } from './CloudFolderBreadcrumbs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SendToCloudDialogProps {
  open: boolean;
  onClose: () => void;
  provider: CloudProvider;
  selectedDesigns: DesignAsset[];
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const HeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
}));

const HeaderTitleBlock = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.25),
}));

const ConnectionDot = styled(Box, {
  shouldForwardProp: (p) => p !== 'connected',
})<{ connected: boolean }>(({ connected }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: connected ? COLORS.successDk : COLORS.warningDk,
  flexShrink: 0,
}));

const BreadcrumbBar = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 3),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(COLORS.ink, 0.3),
}));

const SendButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.vars.palette.secondary.main,
  color: theme.vars.palette.common.white,
  '&:hover': {
    backgroundColor: COLORS.cyanDk,
  },
  '&.Mui-disabled': {
    backgroundColor: alpha(COLORS.cyan, 0.18),
    color: alpha('#fff', 0.4),
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SendToCloudDialog = ({
  open,
  onClose,
  provider,
  selectedDesigns,
}: SendToCloudDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const gdrive = useGoogleDrive();
  const onedrive = useOneDrive();

  const providerHook = provider === 'google_drive' ? gdrive : onedrive;
  const providerName = provider === 'google_drive' ? 'Google Drive' : 'OneDrive';

  const rootLabel = t('publish.cloud.root', { defaultValue: 'Root' });

  const [path, setPath] = useState<CloudPathSegment[]>([{ id: null, name: rootLabel }]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CloudPathSegment | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset state when dialog opens or provider changes
  useEffect(() => {
    if (!open) return;
    setPath([{ id: null, name: rootLabel }]);
    setSelectedFolder(null);
    setFolders([]);
    setLoadError(null);
  }, [open, provider, rootLabel]);

  // Load folders for current path
  useEffect(() => {
    if (!open) return;
    if (!providerHook.isConnected) return;

    let cancelled = false;
    const targetId = path[path.length - 1]?.id ?? null;

    setIsLoadingFolders(true);
    setLoadError(null);
    providerHook
      .listFolders(targetId ?? 'root')
      .then((list) => {
        if (cancelled) return;
        setFolders(list);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(
          t('publish.cloud.loadError', { defaultValue: 'Failed to load folder' }),
        );
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoadingFolders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, providerHook, path, t]);

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

  const canSend =
    providerHook.isConnected && selectedDesigns.length > 0 && !isSending;

  const handleSend = useCallback(async () => {
    if (!canSend) return;
    setIsSending(true);

    const folderId = targetFolder.id ?? 'root';
    let successCount = 0;
    const failures: string[] = [];

    for (const design of selectedDesigns) {
      try {
        const resp = await fetch(design.file_url, { credentials: 'include' });
        if (!resp.ok) throw new Error(`Fetch failed: ${resp.status}`);
        const blob = await resp.blob();
        const file = new File([blob], design.file_name, { type: blob.type });
        await providerHook.uploadFile(file, folderId);
        successCount += 1;
      } catch {
        failures.push(design.file_name);
      }
    }

    setIsSending(false);

    if (failures.length === 0) {
      enqueueSnackbar(
        t('publish.cloud.sendSuccess', {
          defaultValue: '{{count}} file(s) sent to {{provider}}',
          count: successCount,
          provider: providerName,
        }),
        { variant: 'success' },
      );
      onClose();
    } else if (successCount === 0) {
      enqueueSnackbar(
        t('publish.cloud.sendError', {
          defaultValue: 'Failed to send files to {{provider}}',
          provider: providerName,
        }),
        { variant: 'error' },
      );
    } else {
      enqueueSnackbar(
        t('publish.cloud.sendPartial', {
          defaultValue: '{{ok}} succeeded, {{fail}} failed',
          ok: successCount,
          fail: failures.length,
        }),
        { variant: 'warning' },
      );
    }
  }, [
    canSend,
    targetFolder,
    selectedDesigns,
    providerHook,
    enqueueSnackbar,
    providerName,
    t,
    onClose,
  ]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: (theme) => Number(theme.shape.borderRadius) * 2,
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
          <HeaderTitleBlock>
            <CloudUploadOutlinedIcon sx={{ fontSize: 22, color: 'secondary.main' }} />
            <Typography variant="h5">
              {t('publish.cloud.sendTitle', {
                defaultValue: 'Send {{count}} file(s) to {{provider}}',
                count: selectedDesigns.length,
                provider: providerName,
              })}
            </Typography>
            <ConnectionDot connected={providerHook.isConnected} />
          </HeaderTitleBlock>
          <IconButton
            onClick={onClose}
            size="small"
            aria-label={t('common.close', { defaultValue: 'Close' })}
          >
            <CloseIcon />
          </IconButton>
        </HeaderRow>
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
          providerName={providerName}
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
          {t('publish.cloud.uploadTo', {
            defaultValue: 'Upload to: {{folder}}',
            folder: targetFolder.name,
          })}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose} color="inherit" disabled={isSending}>
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <SendButton
            variant="contained"
            disabled={!canSend}
            onClick={handleSend}
            startIcon={
              isSending ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <CloudUploadOutlinedIcon sx={{ fontSize: 18 }} />
              )
            }
          >
            {isSending
              ? t('publish.cloud.sending', { defaultValue: 'Sending...' })
              : t('publish.cloud.send', { defaultValue: 'Send' })}
          </SendButton>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default SendToCloudDialog;
