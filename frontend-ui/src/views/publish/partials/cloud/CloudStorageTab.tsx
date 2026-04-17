import { useState, useCallback, useMemo, useRef } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useGoogleDrive, useOneDrive } from '@/components/CloudStorage';
import type { CloudFile, CloudFolder } from '@/components/CloudStorage';
import { useImportDriveMutation } from '@/store/publishSlice';
import { useSnackbar } from 'notistack';
import ProviderSwitcher from './ProviderSwitcher';
import type { CloudProvider } from './ProviderSwitcher';
import CloudConnectionState from './CloudConnectionState';
import CloudFileCard from '../grid/CloudFileCard';
import TransferProgress from './TransferProgress';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CloudStorageTabProps {
  onManageConnections: () => void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const CloudGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: theme.spacing(2.5),
  position: 'relative',
  userSelect: 'none',
}));

const FolderItem = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  border: `1px solid ${theme.vars.palette.divider}`,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  '&:hover': {
    backgroundColor: theme.vars.palette.action.hover,
  },
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const CloudStorageTab = ({ onManageConnections }: CloudStorageTabProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const gdrive = useGoogleDrive();
  const onedrive = useOneDrive();

  const [activeProvider, setActiveProvider] = useState<CloudProvider>('google_drive');
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [transferStates, setTransferStates] = useState<
    Record<string, 'idle' | 'transferring' | 'done'>
  >({});

  const [importDrive] = useImportDriveMutation();
  const loadedFolderRef = useRef<string | null>(null);

  const provider = activeProvider === 'google_drive' ? gdrive : onedrive;
  const providerName = activeProvider === 'google_drive' ? 'Google Drive' : 'OneDrive';

  // Load folder contents
  const loadFolder = useCallback(
    async (parentId: string | null) => {
      setIsLoadingFiles(true);
      try {
        const [folderList, fileList] = await Promise.all([
          provider.listFolders(parentId ?? 'root'),
          provider.listImages(parentId ?? 'root'),
        ]);
        setFolders(folderList);
        setFiles(fileList);
        loadedFolderRef.current = parentId;
      } catch {
        enqueueSnackbar(
          t('publish.cloud.loadError', { defaultValue: 'Failed to load folder' }),
          { variant: 'error' },
        );
      } finally {
        setIsLoadingFiles(false);
      }
    },
    [provider, enqueueSnackbar, t],
  );

  // Auto-load root when connected
  const lastConnectedProvider = useRef<string | null>(null);
  if (
    provider.isConnected &&
    lastConnectedProvider.current !== activeProvider
  ) {
    lastConnectedProvider.current = activeProvider;
    loadFolder(null);
  }

  // Navigate into subfolder
  const handleFolderClick = useCallback(
    (folder: CloudFolder) => {
      loadFolder(folder.id);
    },
    [loadFolder],
  );

  // Import single file
  const handleImport = useCallback(
    async (fileId: string) => {
      setTransferStates((prev) => ({ ...prev, [fileId]: 'transferring' }));
      try {
        await importDrive({ file_ids: [fileId], provider: activeProvider }).unwrap();
        setTransferStates((prev) => ({ ...prev, [fileId]: 'done' }));
        enqueueSnackbar(
          t('publish.cloud.importSuccess', { defaultValue: 'File imported successfully' }),
          { variant: 'success' },
        );
      } catch {
        setTransferStates((prev) => ({ ...prev, [fileId]: 'idle' }));
        enqueueSnackbar(
          t('publish.cloud.importError', { defaultValue: 'Import failed' }),
          { variant: 'error' },
        );
      }
    },
    [activeProvider, importDrive, enqueueSnackbar, t],
  );

  const handlePreview = useCallback((id: string) => {
    const file = files.find((f) => f.id === id);
    if (file?.webContentLink) {
      window.open(file.webContentLink, '_blank');
    }
  }, [files]);

  const handleCopyUrl = useCallback((id: string) => {
    const file = files.find((f) => f.id === id);
    if (file?.webContentLink) {
      navigator.clipboard.writeText(file.webContentLink);
      enqueueSnackbar(
        t('publish.cloud.urlCopied', { defaultValue: 'URL copied' }),
        { variant: 'success' },
      );
    }
  }, [files, enqueueSnackbar, t]);

  // Provider switch
  const handleProviderChange = useCallback((p: CloudProvider) => {
    setActiveProvider(p);
    setFiles([]);
    setFolders([]);
    setFolderId(null);
    lastConnectedProvider.current = null;
  }, []);

  // Format file size
  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  // Connection state
  const connectionStatus = useMemo(() => {
    if (!provider.isConfigured) return 'not_configured' as const;
    if (provider.isConnecting) return 'loading' as const;
    if (!provider.isConnected) return 'not_connected' as const;
    return null;
  }, [provider]);

  return (
    <Box>
      {/* Provider Switcher */}
      <Box sx={{ mb: 2 }}>
        <ProviderSwitcher
          activeProvider={activeProvider}
          onProviderChange={handleProviderChange}
          googleConnected={gdrive.isConnected}
          onedriveConnected={onedrive.isConnected}
          onManageConnections={onManageConnections}
        />
      </Box>

      {/* Connection states */}
      {connectionStatus ? (
        <CloudConnectionState
          status={connectionStatus}
          providerName={providerName}
          onConnect={provider.connect}
        />
      ) : isLoadingFiles ? (
        <CloudConnectionState status="loading" providerName={providerName} />
      ) : files.length === 0 && folders.length === 0 ? (
        <CloudConnectionState status="empty" providerName={providerName} />
      ) : (
        <CloudGrid>
          {/* Folders first */}
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              onClick={() => handleFolderClick(folder)}
              aria-label={folder.name}
            >
              <Box sx={{ fontSize: 24, color: 'text.secondary' }}>
                {'\uD83D\uDCC1'}
              </Box>
              <Box>
                <Box sx={{ typography: 'subtitle2' }}>{folder.name}</Box>
              </Box>
            </FolderItem>
          ))}

          {/* Files */}
          {files.map((file) => (
            <Box key={file.id} sx={{ position: 'relative' }}>
              <CloudFileCard
                id={file.id}
                fileName={file.name}
                thumbnailUrl={file.thumbnailUrl}
                modifiedDate={undefined}
                fileSize={formatSize(file.size)}
                provider={activeProvider}
                onImport={handleImport}
                onPreview={handlePreview}
                onCopyUrl={handleCopyUrl}
              />
              <TransferProgress
                status={transferStates[file.id] ?? 'idle'}
              />
            </Box>
          ))}
        </CloudGrid>
      )}
    </Box>
  );
};

export default CloudStorageTab;
