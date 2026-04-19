import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Grow,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Slide,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import {
  Dock,
  ActionButton,
  CounterText,
  Separator,
  STAGGER_STEP_MS,
} from './ActionBar.styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ActionBarProps {
  selectionCount: number;
  allSelected: boolean;
  onEdit: () => void;
  onToggleAll: () => void;
  onHistory: () => void;
  onBatchUpload: () => void;
  onDelete: () => void;
  onApplyTemplate?: () => void;
  onCopyFrom?: () => void;
  onApplyColors?: () => void;
  onApplyFitTypes?: () => void;
  onExportSelected?: () => void;
}

// ---------------------------------------------------------------------------
// Stagger helper — wraps a slot in Grow with a per-index entry delay.
// Exit runs without delay so everything rides the outer Slide uniformly.
// ---------------------------------------------------------------------------

interface StaggerSlotProps {
  in: boolean;
  index: number;
  children: React.ReactElement;
}

const StaggerSlot = ({ in: inProp, index, children }: StaggerSlotProps) => (
  <Grow
    in={inProp}
    timeout={{ enter: DURATION.default, exit: DURATION.fast }}
    style={{
      transitionDelay: inProp ? `${index * STAGGER_STEP_MS}ms` : '0ms',
      transformOrigin: 'bottom center',
    }}
  >
    {children}
  </Grow>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ActionBar = ({
  selectionCount,
  allSelected,
  onEdit,
  onToggleAll,
  onHistory,
  onBatchUpload,
  onDelete,
  onApplyTemplate,
  onCopyFrom,
  onApplyColors,
  onApplyFitTypes,
  onExportSelected,
}: ActionBarProps) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [counterPop, setCounterPop] = useState(false);
  const prevCount = useRef(selectionCount);

  const open = selectionCount > 0;

  // Counter pop animation — setTimeout avoids synchronous setState in effect
  useEffect(() => {
    if (selectionCount === prevCount.current || selectionCount === 0) {
      prevCount.current = selectionCount;
      return;
    }
    prevCount.current = selectionCount;
    const t1 = setTimeout(() => setCounterPop(true), 0);
    const t2 = setTimeout(() => setCounterPop(false), DURATION.fast);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [selectionCount]);

  const handleMenuOpen = useCallback((e: React.MouseEvent<HTMLElement>) => {
    setMenuAnchor(e.currentTarget);
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  let slotIdx = 0;
  const nextIdx = () => slotIdx++;

  return (
    <Slide
      direction="up"
      in={open}
      mountOnEnter
      unmountOnExit
      timeout={{ enter: DURATION.slow, exit: DURATION.default }}
      easing={{ enter: EASING.enter, exit: EASING.exit }}
    >
      <Dock
        role="toolbar"
        aria-label={t('publish.actionBar.label', { defaultValue: 'Selection actions' })}
      >
        {/* Counter */}
        <StaggerSlot in={open} index={nextIdx()}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pr: 1 }}>
            <CounterText
              variant="subtitle2"
              sx={{ transform: counterPop ? 'scale(1.15)' : 'scale(1)' }}
            >
              {selectionCount}
            </CounterText>
            <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
          </Box>
        </StaggerSlot>

        <StaggerSlot in={open} index={nextIdx()}>
          <Separator />
        </StaggerSlot>

        {/* Edit */}
        <StaggerSlot in={open} index={nextIdx()}>
          {isCompact ? (
            <Tooltip title={t('publish.actionBar.edit', { defaultValue: 'Edit' })}>
              <IconButton
                size="small"
                onClick={onEdit}
                sx={{ color: COLORS.cyan, '&:hover': { backgroundColor: alpha(COLORS.cyan, 0.12) } }}
              >
                <EditOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <ActionButton
              variant="text"
              size="small"
              startIcon={<EditOutlinedIcon />}
              onClick={onEdit}
              sx={{ color: COLORS.cyan, '&:hover': { backgroundColor: alpha(COLORS.cyan, 0.12) } }}
            >
              {t('publish.actionBar.edit', { defaultValue: 'Edit' })}
            </ActionButton>
          )}
        </StaggerSlot>

        {/* All/None toggle */}
        <StaggerSlot in={open} index={nextIdx()}>
          {isCompact ? (
            <Tooltip title={allSelected
              ? t('publish.actionBar.selectNone', { defaultValue: 'None' })
              : t('publish.actionBar.selectAll', { defaultValue: 'All' })}
            >
              <IconButton size="small" onClick={onToggleAll}>
                {allSelected
                  ? <RadioButtonUncheckedIcon sx={{ fontSize: 16 }} />
                  : <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
          ) : (
            <ActionButton
              variant="text"
              size="small"
              startIcon={allSelected ? <RadioButtonUncheckedIcon /> : <CheckCircleOutlineIcon />}
              onClick={onToggleAll}
            >
              {allSelected
                ? t('publish.actionBar.selectNone', { defaultValue: 'None' })
                : t('publish.actionBar.selectAll', { defaultValue: 'All' })}
            </ActionButton>
          )}
        </StaggerSlot>

        {/* History */}
        <StaggerSlot in={open} index={nextIdx()}>
          {isCompact ? (
            <Tooltip title={t('publish.actionBar.history', { defaultValue: 'History' })}>
              <IconButton size="small" onClick={onHistory}>
                <HistoryOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <ActionButton
              variant="text"
              size="small"
              startIcon={<HistoryOutlinedIcon />}
              onClick={onHistory}
            >
              {t('publish.actionBar.history', { defaultValue: 'History' })}
            </ActionButton>
          )}
        </StaggerSlot>

        {/* Batch upload */}
        <StaggerSlot in={open} index={nextIdx()}>
          {isCompact ? (
            <Tooltip title={t('publish.actionBar.batch', { defaultValue: 'Batch' })}>
              <IconButton
                size="small"
                onClick={onBatchUpload}
                sx={{ color: COLORS.successDk, '&:hover': { backgroundColor: alpha(COLORS.successDk, 0.1) } }}
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <ActionButton
              variant="text"
              size="small"
              startIcon={<CloudUploadOutlinedIcon />}
              onClick={onBatchUpload}
              sx={{ color: COLORS.successDk, '&:hover': { backgroundColor: alpha(COLORS.successDk, 0.1) } }}
            >
              {t('publish.actionBar.batch', { defaultValue: 'Batch' })}
            </ActionButton>
          )}
        </StaggerSlot>

        {/* Options dropdown */}
        <StaggerSlot in={open} index={nextIdx()}>
          {isCompact ? (
            <Tooltip title={t('publish.actionBar.options', { defaultValue: 'Options' })}>
              <IconButton size="small" onClick={handleMenuOpen}>
                <SettingsOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          ) : (
            <ActionButton
              variant="text"
              size="small"
              startIcon={<SettingsOutlinedIcon />}
              onClick={handleMenuOpen}
            >
              {t('publish.actionBar.options', { defaultValue: 'Options' })}
            </ActionButton>
          )}
        </StaggerSlot>

        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {onApplyTemplate && (
            <MenuItem onClick={() => { onApplyTemplate(); handleMenuClose(); }}>
              <ListItemIcon><DashboardCustomizeOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText>{t('publish.actionBar.applyTemplate', { defaultValue: 'Apply Template' })}</ListItemText>
            </MenuItem>
          )}
          {onCopyFrom && (
            <MenuItem onClick={() => { onCopyFrom(); handleMenuClose(); }}>
              <ListItemIcon><ContentCopyOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText>{t('publish.actionBar.copyFrom', { defaultValue: 'Copy From...' })}</ListItemText>
            </MenuItem>
          )}
          {onApplyColors && (
            <MenuItem onClick={() => { onApplyColors(); handleMenuClose(); }}>
              <ListItemIcon><PaletteOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText>{t('publish.actionBar.applyColors', { defaultValue: 'Apply Colors' })}</ListItemText>
            </MenuItem>
          )}
          {onApplyFitTypes && (
            <MenuItem onClick={() => { onApplyFitTypes(); handleMenuClose(); }}>
              <ListItemIcon><StraightenOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText>{t('publish.actionBar.applyFitTypes', { defaultValue: 'Apply Fit Types' })}</ListItemText>
            </MenuItem>
          )}
          {onExportSelected && (
            <MenuItem onClick={() => { onExportSelected(); handleMenuClose(); }}>
              <ListItemIcon><FileDownloadOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
              <ListItemText>{t('publish.actionBar.exportSelected', { defaultValue: 'Export Selected' })}</ListItemText>
            </MenuItem>
          )}
        </Menu>

        <StaggerSlot in={open} index={nextIdx()}>
          <Separator />
        </StaggerSlot>

        {/* Delete (far right) */}
        <StaggerSlot in={open} index={nextIdx()}>
          <Tooltip title={t('publish.actionBar.delete', { defaultValue: 'Delete' })}>
            <IconButton
              size="small"
              onClick={onDelete}
              sx={{
                width: 32,
                height: 32,
                color: 'text.disabled',
                transition: `all ${DURATION.fast}ms ${EASING.standard}`,
                '&:hover': {
                  color: 'error.main',
                  backgroundColor: alpha(COLORS.errorDk, 0.1),
                },
              }}
            >
              <DeleteOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </StaggerSlot>
      </Dock>
    </Slide>
  );
};

export default ActionBar;
