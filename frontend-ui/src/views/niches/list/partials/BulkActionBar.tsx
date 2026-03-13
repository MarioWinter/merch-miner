import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Slide,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../store';
import { useBulkNicheActionMutation } from '../../../../store/nicheSlice';
import type { UseNicheSelectionReturn } from '../hooks/useNicheSelection';

interface BulkActionBarProps {
  selection: UseNicheSelectionReturn;
  sidebarCollapsed: boolean;
}

const SIDEBAR_EXPANDED = 220;
const SIDEBAR_COLLAPSED = 60;

interface BarRootProps {
  leftoffset: number;
}

const BarRoot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'leftoffset',
})<BarRootProps>(({ theme, leftoffset }) => ({
  position: 'fixed',
  bottom: 0,
  left: leftoffset,
  right: 0,
  zIndex: theme.zIndex.appBar - 1,
  background: alpha(COLORS.inkPaper, 0.75),
  backdropFilter: 'blur(16px)',
  borderTop: `1px solid ${alpha(COLORS.white, 0.14)}`,
  boxShadow: `0 -8px 32px ${alpha(COLORS.black, 0.40)}`,
  padding: `${theme.spacing(1.5)} ${theme.spacing(2)}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  transition: `left 200ms cubic-bezier(0.4, 0.0, 0.2, 1)`,
}));

const DestructiveButton = styled(Button)(({ theme }) => ({
  color: theme.vars.palette.error.main,
  borderColor: alpha(COLORS.errorDk, 0.30),
  '&:hover': {
    backgroundColor: alpha(COLORS.errorDk, 0.08),
    borderColor: alpha(COLORS.errorDk, 0.50),
  },
}));

export const BulkActionBar = ({ selection, sidebarCollapsed }: BulkActionBarProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { selectedIds, selectedCount, clearSelection } = selection;

  const activeWorkspaceId = useSelector((s: RootState) => s.workspace.activeWorkspaceId);
  const workspaces = useSelector((s: RootState) => s.workspace.workspaces);
  const members = workspaces.find((w) => w.id === activeWorkspaceId)?.members ?? [];

  const [bulkAction, { isLoading }] = useBulkNicheActionMutation();

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [assignMenuAnchor, setAssignMenuAnchor] = useState<HTMLElement | null>(null);

  const leftOffset = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const handleArchiveConfirm = async () => {
    try {
      const result = await bulkAction({
        ids: Array.from(selectedIds),
        action: 'archive',
      }).unwrap();
      enqueueSnackbar(t('niches.bulk.archiveSuccess', { count: result.updated }), {
        variant: 'success',
      });
      clearSelection();
    } catch {
      enqueueSnackbar(t('niches.notifications.archiveError'), { variant: 'error' });
    } finally {
      setArchiveDialogOpen(false);
    }
  };

  const handleAssign = async (userId: number) => {
    setAssignMenuAnchor(null);
    try {
      const result = await bulkAction({
        ids: Array.from(selectedIds),
        action: 'assign',
        assigned_to: String(userId),
      }).unwrap();
      enqueueSnackbar(t('niches.bulk.assignSuccess', { count: result.updated }), {
        variant: 'success',
      });
      clearSelection();
    } catch {
      enqueueSnackbar(t('niches.notifications.updateError'), { variant: 'error' });
    }
  };

  return (
    <>
      <Slide direction="up" in={selectedCount > 0} mountOnEnter unmountOnExit timeout={200}>
        <BarRoot leftoffset={leftOffset} role="toolbar" aria-label="Bulk actions">
          <Typography variant="body2" fontWeight={600} sx={{ mr: 1 }}>
            {t('niches.bulk.selected', { count: selectedCount })}
          </Typography>

          <DestructiveButton
            variant="outlined"
            size="small"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setArchiveDialogOpen(true)}
            disabled={isLoading}
          >
            {t('niches.bulk.archive')}
          </DestructiveButton>

          <Button
            variant="outlined"
            size="small"
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setAssignMenuAnchor(e.currentTarget)}
            disabled={isLoading}
          >
            {t('niches.bulk.assign')}
          </Button>

          <Box sx={{ flex: 1 }} />

          <IconButton
            size="small"
            onClick={clearSelection}
            aria-label={t('niches.bulk.clearSelection')}
            sx={{ borderRadius: '8px' }}
          >
            {isLoading ? (
              <CircularProgress size={16} />
            ) : (
              <CloseIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </BarRoot>
      </Slide>

      {/* Assign dropdown menu */}
      <Menu
        anchorEl={assignMenuAnchor}
        open={Boolean(assignMenuAnchor)}
        onClose={() => setAssignMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {members.map((m) => (
          <MenuItem key={m.id} onClick={() => handleAssign(m.id)}>
            {m.first_name || m.last_name
              ? `${m.first_name} ${m.last_name}`.trim()
              : m.username}
          </MenuItem>
        ))}
      </Menu>

      {/* Archive confirmation dialog */}
      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        aria-labelledby="bulk-archive-dialog-title"
      >
        <DialogTitle id="bulk-archive-dialog-title">
          {t('niches.bulk.archiveConfirmTitle', { count: selectedCount })}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.bulk.archiveConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setArchiveDialogOpen(false)} disabled={isLoading}>
            {t('niches.drawer.archiveCancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleArchiveConfirm}
            disabled={isLoading}
          >
            {t('niches.bulk.archive')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
