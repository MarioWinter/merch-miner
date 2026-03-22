import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';

interface DrawerConfirmDialogsProps {
  archiveDialogOpen: boolean;
  setArchiveDialogOpen: (open: boolean) => void;
  handleArchiveConfirm: () => void;
  deleting: boolean;
  unsavedDialogOpen: boolean;
  setUnsavedDialogOpen: (open: boolean) => void;
  discardAndClose: () => void;
}

export const DrawerConfirmDialogs = ({
  archiveDialogOpen,
  setArchiveDialogOpen,
  handleArchiveConfirm,
  deleting,
  unsavedDialogOpen,
  setUnsavedDialogOpen,
  discardAndClose,
}: DrawerConfirmDialogsProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Dialog
        open={archiveDialogOpen}
        onClose={() => setArchiveDialogOpen(false)}
        aria-labelledby="archive-drawer-dialog-title"
      >
        <DialogTitle id="archive-drawer-dialog-title">
          {t('niches.drawer.archiveConfirmTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.archiveConfirmBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setArchiveDialogOpen(false)} disabled={deleting}>
            {t('niches.drawer.archiveCancel')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleArchiveConfirm}
            disabled={deleting}
          >
            {t('niches.drawer.archiveConfirm')}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={unsavedDialogOpen}
        onClose={() => setUnsavedDialogOpen(false)}
        aria-labelledby="unsaved-dialog-title"
      >
        <DialogTitle id="unsaved-dialog-title">
          {t('niches.drawer.unsavedChangesTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{t('niches.drawer.unsavedChangesBody')}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="text" onClick={() => setUnsavedDialogOpen(false)}>
            {t('niches.drawer.keepEditing')}
          </Button>
          <Button variant="outlined" color="error" onClick={discardAndClose}>
            {t('niches.drawer.discardChanges')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
