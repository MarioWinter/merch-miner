import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, styled, useTheme } from '@mui/material/styles';
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
// Styled
// ---------------------------------------------------------------------------

const Dock = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(3),
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: alpha(COLORS.inkPaper, 0.9),
  backdropFilter: 'blur(20px)',
  border: `1px solid ${alpha('#fff', 0.12)}`,
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  boxShadow: `0 8px 32px ${alpha(COLORS.ink, 0.5)}`,
  padding: theme.spacing(1, 2),
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minWidth: theme.spacing(50),
  maxWidth: theme.spacing(87.5),
  zIndex: theme.zIndex.speedDial,
  [theme.breakpoints.down('sm')]: {
    minWidth: 'auto',
    padding: theme.spacing(1),
    gap: theme.spacing(0.5),
  },
}));

const ActionButton = styled(Button)(({ theme }) => ({
  height: theme.spacing(4),
  fontSize: theme.typography.caption.fontSize,
  fontWeight: 500,
  color: theme.vars.palette.text.secondary,
  borderRadius: Number(theme.shape.borderRadius) * 0.75,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '& .MuiButton-startIcon': { '& > *': { fontSize: 16 } },
  '&:hover': {
    backgroundColor: alpha('#fff', 0.08),
    color: theme.vars.palette.text.primary,
  },
}));

const CounterText = styled(Typography)({
  fontWeight: 600,
  color: COLORS.cyan,
  transition: `transform ${DURATION.fast}ms ${EASING.standard}`,
});

const Separator = styled(Box)(({ theme }) => ({
  width: 1,
  height: theme.spacing(3),
  backgroundColor: alpha('#fff', 0.08),
  flexShrink: 0,
}));

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

  if (selectionCount === 0) return null;

  return (
    <Dock
      role="toolbar"
      aria-label={t('publish.actionBar.label', { defaultValue: 'Selection actions' })}
    >
      {/* Counter */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pr: 1 }}>
        <CounterText
          variant="subtitle2"
          sx={{ transform: counterPop ? 'scale(1.15)' : 'scale(1)' }}
        >
          {selectionCount}
        </CounterText>
        <InfoOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
      </Box>

      <Separator />

      {/* Edit */}
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

      {/* All/None toggle */}
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

      {/* History */}
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

      {/* Batch upload */}
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

      {/* Options dropdown */}
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

      <Separator />

      {/* Delete (far right) */}
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
    </Dock>
  );
};

export default ActionBar;
