import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useTranslation } from 'react-i18next';
import {
  useGetCollectionTreeQuery,
  useListCollectionsQuery,
  useCreateCollectionMutation,
} from '@/store/publishSlice';
import { COLORS } from '@/style/constants';
import FolderTree from './FolderTree';
import FolderGrid from './FolderGrid';
import BreadcrumbNav from '../toolbar/BreadcrumbNav';
import type { BreadcrumbSegment, ViewMode } from '../../types';

interface CollectionsDialogProps {
  open: boolean;
  onClose: () => void;
  onOpenFolder: (collectionId: string | null) => void;
}

const DialogBody = styled(Box)(({ theme }) => ({
  display: 'flex',
  height: 420,
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const HeaderToolbar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 3),
}));

const ViewToggleBtn = styled(ToggleButton)({
  '&.Mui-selected': {
    backgroundColor: alpha(COLORS.red, 0.12),
    color: COLORS.red,
    '&:hover': {
      backgroundColor: alpha(COLORS.red, 0.18),
    },
  },
});

const CollectionsDialog = ({ open, onClose, onOpenFolder }: CollectionsDialogProps) => {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // API queries
  const { data: tree, isLoading: treeLoading } = useGetCollectionTreeQuery(undefined, {
    skip: !open,
  });
  const { data: folders, isLoading: foldersLoading } = useListCollectionsQuery(
    selectedId ? { parent: selectedId } : undefined,
    { skip: !open },
  );
  const [createCollection] = useCreateCollectionMutation();

  // Build breadcrumbs
  const breadcrumbs: BreadcrumbSegment[] = [
    { id: null, label: t('publish.collections.home', { defaultValue: 'Home' }) },
  ];
  // In a full impl, we'd walk the tree to build the full path.
  // For now, show Home + selected folder name if available.
  if (selectedId && folders) {
    // We only have the current level; a proper breadcrumb needs the tree walk
    // Placeholder — will be enhanced when collection detail provides parent chain
  }

  const handleAddFolder = useCallback(
    async (name: string) => {
      try {
        await createCollection({ name, parent: selectedId }).unwrap();
      } catch {
        // Error handled by RTK Query
      }
    },
    [createCollection, selectedId],
  );

  const handleFolderClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleFolderDoubleClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleViewChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: ViewMode | null) => {
      if (value) setViewMode(value);
    },
    [],
  );

  const handleOpenFolder = useCallback(() => {
    onOpenFolder(selectedId);
    onClose();
  }, [onOpenFolder, selectedId, onClose]);

  const handleBreadcrumbNavigate = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  const filteredFolders = (folders ?? []).filter((f) =>
    searchQuery
      ? f.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: (theme) => `${Number(theme.shape.borderRadius) * 2}px`,
          maxHeight: 600,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box component="span" sx={{ typography: 'h5' }}>
          {t('publish.collections.title', { defaultValue: 'Collections' })}
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Toolbar row */}
      <HeaderToolbar>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
        >
          <ViewToggleBtn value="grid" aria-label="Grid">
            <GridViewOutlinedIcon sx={{ fontSize: 18 }} />
          </ViewToggleBtn>
          <ViewToggleBtn value="list" aria-label="List">
            <ViewListOutlinedIcon sx={{ fontSize: 18 }} />
          </ViewToggleBtn>
        </ToggleButtonGroup>

        <BreadcrumbNav
          segments={breadcrumbs}
          onNavigate={handleBreadcrumbNavigate}
        />

        <Box sx={{ flex: 1 }} />

        <TextField
          size="small"
          variant="outlined"
          placeholder={t('publish.collections.searchFolders', { defaultValue: 'Search folders...' })}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{ width: 200 }}
        />
      </HeaderToolbar>

      {/* Split panel body */}
      <DialogContent sx={{ p: 0 }}>
        <DialogBody>
          <FolderTree
            tree={tree ?? []}
            selectedId={selectedId}
            onSelect={setSelectedId}
            isLoading={treeLoading}
          />
          <FolderGrid
            folders={filteredFolders}
            selectedFolderId={selectedId}
            onFolderClick={handleFolderClick}
            onFolderDoubleClick={handleFolderDoubleClick}
            onAddFolder={handleAddFolder}
            isLoading={foldersLoading}
          />
        </DialogBody>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="contained"
          onClick={handleOpenFolder}
          sx={{
            backgroundColor: (theme) => theme.vars.palette.secondary.main,
            '&:hover': {
              backgroundColor: COLORS.cyanDk,
            },
          }}
        >
          {t('publish.collections.openFolder', { defaultValue: 'Open Folder' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CollectionsDialog;
