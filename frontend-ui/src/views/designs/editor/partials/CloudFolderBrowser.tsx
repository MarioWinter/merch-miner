import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  Breadcrumbs,
  Link,
  Checkbox,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { useTranslation } from 'react-i18next';
import type { CloudFile, CloudFolder } from '@/components/CloudStorage';
import { CloudFileTable } from './CloudFileTable';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

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
// Types
// -----------------------------------------------------------------

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface CloudFolderBrowserProps {
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

export const CloudFolderBrowser = ({
  listFolders,
  listImages,
  uploadFile,
  onUseForAi,
  onDownload,
  batchFileNames,
  getBatchFile,
}: CloudFolderBrowserProps) => {
  const { t } = useTranslation();

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: t('design.cloud.breadcrumbRoot') },
  ]);
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasBrowsed, setHasBrowsed] = useState(false);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadFolder = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setFetchError(null);
    setSelected(new Set());
    try {
      const [folderList, imageList] = await Promise.all([
        listFolders(folderId),
        listImages(folderId),
      ]);
      setFolders(folderList);
      setFiles(imageList);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : t('design.cloud.fetchError'));
    } finally {
      setIsLoading(false);
    }
  }, [listFolders, listImages, t]);

  const handleFolderClick = useCallback((folder: CloudFolder) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFolder(folder.id);
  }, [loadFolder]);

  const handleBreadcrumbClick = useCallback((index: number) => {
    const target = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    loadFolder(target.id);
  }, [breadcrumbs, loadFolder]);

  const handleBrowse = useCallback(() => {
    setHasBrowsed(true);
    setBreadcrumbs([{ id: 'root', name: t('design.cloud.breadcrumbRoot') }]);
    loadFolder('root');
  }, [loadFolder, t]);

  const handleToggleSelect = useCallback((fileId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selected.size === files.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(files.map((f) => f.id)));
    }
  }, [files, selected.size]);

  const selectedFiles = files.filter((f) => selected.has(f.id));

  const handleUploadBatch = useCallback(async () => {
    if (!batchFileNames?.length || !getBatchFile) return;
    setIsUploading(true);
    try {
      for (const name of batchFileNames) {
        const file = getBatchFile(name);
        if (file) await uploadFile(file, currentFolderId);
      }
    } finally {
      setIsUploading(false);
    }
  }, [batchFileNames, getBatchFile, uploadFile, currentFolderId]);

  // Initial state -- not yet browsed
  if (!hasBrowsed) {
    return (
      <Button size="small" variant="outlined" color="secondary" onClick={handleBrowse}>
        {t('design.cloud.browseFiles')}
      </Button>
    );
  }

  return (
    <>
      {/* Breadcrumb navigation */}
      <Breadcrumbs aria-label="folder navigation">
        {breadcrumbs.map((bc, i) => {
          const isLast = i === breadcrumbs.length - 1;
          return isLast ? (
            <Typography key={bc.id} variant="body2" color="text.primary">
              {bc.name}
            </Typography>
          ) : (
            <Link
              key={bc.id}
              component="button"
              variant="body2"
              underline="hover"
              color="secondary"
              onClick={() => handleBreadcrumbClick(i)}
            >
              {bc.name}
            </Link>
          );
        })}
      </Breadcrumbs>

      {fetchError && <Alert severity="error">{fetchError}</Alert>}

      {isLoading && (
        <CenterBox>
          <CircularProgress size={32} color="secondary" />
        </CenterBox>
      )}

      {!isLoading && folders.length > 0 && (
        <Stack spacing={0.5}>
          {folders.map((folder) => (
            <Button
              key={folder.id}
              variant="text"
              startIcon={<FolderOpenIcon />}
              onClick={() => handleFolderClick(folder)}
              sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
            >
              {folder.name}
            </Button>
          ))}
        </Stack>
      )}

      {!isLoading && files.length > 0 && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack direction="row" alignItems="center" spacing={1}>
              <Checkbox
                checked={selected.size === files.length && files.length > 0}
                indeterminate={selected.size > 0 && selected.size < files.length}
                onChange={handleSelectAll}
                size="small"
              />
              <Typography variant="body2" color="text.secondary">
                {t('design.cloud.fileCount', { count: files.length })}
                {selected.size > 0 && ` (${t('design.cloud.selectedFiles', { count: selected.size })})`}
              </Typography>
            </Stack>
            {selected.size > 0 && (
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => onDownload(selectedFiles)}>
                  {t('design.cloud.download')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => onUseForAi(selectedFiles)}
                >
                  {t('design.cloud.useForAi')}
                </Button>
              </Stack>
            )}
          </Stack>
          <CloudFileTable
            files={files}
            selected={selected}
            onToggleSelect={handleToggleSelect}
            onUseForAi={(f) => onUseForAi([f])}
            onDownload={(f) => onDownload([f])}
          />
        </>
      )}

      {!isLoading && files.length === 0 && folders.length === 0 && !fetchError && (
        <CenterBox>
          <Typography variant="body2" color="text.disabled">
            {t('design.cloud.noImages')}
          </Typography>
        </CenterBox>
      )}

      {!isLoading && batchFileNames && batchFileNames.length > 0 && (
        <Stack direction="row" alignItems="center" spacing={2} sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary">
            {t('design.cloud.uploadToCloud')}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            onClick={handleUploadBatch}
            disabled={isUploading}
            startIcon={isUploading ? <CircularProgress size={14} /> : undefined}
          >
            {isUploading ? t('design.cloud.uploading') : t('design.cloud.uploadToBatch')}
          </Button>
        </Stack>
      )}
    </>
  );
};
