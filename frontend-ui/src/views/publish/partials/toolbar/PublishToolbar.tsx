import { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Divider,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CloudDownloadOutlinedIcon from '@mui/icons-material/CloudDownloadOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type { FileSystemTab, ViewMode, BreadcrumbSegment } from '../../types';
import SelectCounter from './SelectCounter';
import FileSystemTabs from './FileSystemTabs';
import BreadcrumbNav from './BreadcrumbNav';
import TransferPill from './TransferPill';

interface PublishToolbarProps {
  // Selection
  selectedCount: number;
  totalCount: number;
  hasSelection: boolean;
  onSelectAll: () => void;
  onSelectNone: () => void;
  // View
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  // Tabs
  activeTab: FileSystemTab;
  onTabChange: (tab: FileSystemTab) => void;
  cloudConnected?: boolean;
  // Breadcrumbs
  breadcrumbs: BreadcrumbSegment[];
  onBreadcrumbNavigate: (collectionId: string | null) => void;
  // Transfer
  transferCount: number;
  onTransferClick: () => void;
  // Actions
  onCollectionsOpen: () => void;
  onCommandPaletteOpen: () => void;
  onTemplateClick: () => void;
  onUploadClick: () => void;
  onPublishClick: () => void;
}

const ToolbarRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const Row1 = styled(ToolbarRow)(({ theme }) => ({
  height: 48,
  gap: theme.spacing(1.5),
  backgroundColor: theme.vars.palette.background.paper,
}));

const Row2 = styled(ToolbarRow)({
  height: 40,
  justifyContent: 'space-between',
});

const VerticalDivider = styled(Divider)(({ theme }) => ({
  height: 24,
  margin: theme.spacing(0, 0.5),
}));

const PublishButton = styled(Button)(({ theme }) => ({
  backgroundColor: theme.vars.palette.secondary.main,
  color: theme.vars.palette.common.white,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: COLORS.cyanDk,
    boxShadow: `0 0 16px ${alpha(COLORS.cyan, 0.25)}`,
  },
}));

const ViewToggleButton = styled(ToggleButton)({
  '&.Mui-selected': {
    backgroundColor: alpha(COLORS.red, 0.12),
    color: COLORS.red,
    '&:hover': {
      backgroundColor: alpha(COLORS.red, 0.18),
    },
  },
});

const PublishToolbar = ({
  selectedCount,
  totalCount,
  hasSelection,
  onSelectAll,
  onSelectNone,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  activeTab,
  onTabChange,
  cloudConnected,
  breadcrumbs,
  onBreadcrumbNavigate,
  transferCount,
  onTransferClick,
  onCollectionsOpen,
  onCommandPaletteOpen,
  onTemplateClick,
  onUploadClick,
  onPublishClick,
}: PublishToolbarProps) => {
  const { t } = useTranslation();
  const [searchFocused, setSearchFocused] = useState(false);
  const isCloudTab = activeTab === 'cloud_storage';

  const handleViewChange = useCallback(
    (_: React.MouseEvent<HTMLElement>, value: ViewMode | null) => {
      if (value) onViewModeChange(value);
    },
    [onViewModeChange],
  );

  // Tab-context button labels morph
  const collectionsLabel = isCloudTab
    ? t('publish.toolbar.folders', { defaultValue: 'Folders' })
    : t('publish.toolbar.collections', { defaultValue: 'Collections' });

  const uploadLabel = isCloudTab
    ? t('publish.toolbar.import', { defaultValue: 'Import' })
    : t('publish.toolbar.upload', { defaultValue: 'Upload' });

  const UploadIcon = isCloudTab ? CloudDownloadOutlinedIcon : FileUploadOutlinedIcon;

  return (
    <Box sx={{ position: 'sticky', top: 56, zIndex: (theme) => theme.zIndex.appBar - 1 }}>
      {/* Row 1: Actions */}
      <Row1>
        {/* Left group */}
        <SelectCounter
          selectedCount={selectedCount}
          totalCount={totalCount}
          hasSelection={hasSelection}
          onSelectAll={onSelectAll}
          onSelectNone={onSelectNone}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<FolderOutlinedIcon />}
          onClick={onCollectionsOpen}
          sx={{ height: (theme) => theme.spacing(4) }}
        >
          {collectionsLabel}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<BoltOutlinedIcon />}
          endIcon={<ArrowDropDownIcon />}
          onClick={onCommandPaletteOpen}
          sx={{ height: (theme) => theme.spacing(4) }}
        >
          {t('publish.toolbar.chooseAction', { defaultValue: 'Choose Action' })}
        </Button>

        {/* Center: separator + view + search */}
        <VerticalDivider orientation="vertical" />
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewChange}
          size="small"
          aria-label="View mode"
        >
          <ViewToggleButton value="list" aria-label="List view">
            <ViewListOutlinedIcon sx={{ fontSize: 20 }} />
          </ViewToggleButton>
          <ViewToggleButton value="grid" aria-label="Grid view">
            <GridViewOutlinedIcon sx={{ fontSize: 20 }} />
          </ViewToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          variant="outlined"
          placeholder={t('publish.toolbar.search', { defaultValue: 'Search...' })}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlinedIcon sx={{ fontSize: 20 }} />
                </InputAdornment>
              ),
            },
          }}
          sx={{
            width: searchFocused ? 320 : 240,
            transition: `width ${DURATION.default}ms ${EASING.standard}`,
            '& .MuiOutlinedInput-root': {
              backgroundColor: (theme) => theme.vars.palette.background.default,
            },
          }}
        />

        {/* Right group */}
        <Box sx={{ flex: 1 }} />
        {/* Round-5: Template + Publish wired to real dialogs.
            Template → TemplateLibraryDialog (list + delete). Publish →
            PublishBatchDialog (pick template + POST /upload-jobs/batch/). */}
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditNoteOutlinedIcon />}
          onClick={onTemplateClick}
          sx={{ height: (theme) => theme.spacing(4) }}
        >
          {t('publish.toolbar.template', { defaultValue: 'Template' })}
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<UploadIcon />}
          onClick={onUploadClick}
          sx={{ height: (theme) => theme.spacing(4) }}
        >
          {uploadLabel}
        </Button>
        <Tooltip
          title={
            hasSelection
              ? ''
              : t('publish.toolbar.publishNoSelectionHint', {
                  defaultValue: 'Select at least one design to publish',
                })
          }
        >
          <span>
            <PublishButton
              variant="contained"
              size="small"
              startIcon={<RocketLaunchOutlinedIcon />}
              disabled={!hasSelection}
              onClick={onPublishClick}
            >
              {t('publish.toolbar.publish', { defaultValue: 'Publish' })}
            </PublishButton>
          </span>
        </Tooltip>
      </Row1>

      {/* Row 2: File System Tabs + Breadcrumbs */}
      <Row2>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FileSystemTabs
            activeTab={activeTab}
            onTabChange={onTabChange}
            cloudConnected={cloudConnected}
          />
          <TransferPill
            count={transferCount}
            visible={hasSelection && transferCount > 0}
            onClick={onTransferClick}
          />
        </Box>
        <BreadcrumbNav
          segments={breadcrumbs}
          onNavigate={onBreadcrumbNavigate}
        />
      </Row2>
    </Box>
  );
};

export default PublishToolbar;
