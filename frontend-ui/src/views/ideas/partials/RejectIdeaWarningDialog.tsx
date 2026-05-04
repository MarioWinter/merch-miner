import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';

interface RejectIdeaWarningDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RejectIdeaWarningDialog = ({
  open,
  onConfirm,
  onCancel,
}: RejectIdeaWarningDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby="reject-idea-warning-title"
    >
      <DialogTitle
        id="reject-idea-warning-title"
        sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
      >
        <WarningAmberIcon sx={{ color: 'warning.main', fontSize: 24 }} />
        {t('ideas.rejectWarning.title')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('ideas.rejectWarning.body')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          {t('ideas.rejectWarning.cancel')}
        </Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          {t('ideas.rejectWarning.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
