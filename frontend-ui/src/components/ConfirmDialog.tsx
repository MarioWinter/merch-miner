import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  /** Defaults to 'error' */
  confirmColor?: 'error' | 'primary' | 'warning';
  /** Show delete icon on confirm button. Defaults to true */
  showDeleteIcon?: boolean;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  isLoading = false,
  confirmColor = 'error',
  showDeleteIcon = true,
}: ConfirmDialogProps) => (
  <Dialog
    open={open}
    onClose={onCancel}
    aria-labelledby="confirm-dialog-title"
    maxWidth="xs"
    fullWidth
  >
    <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
    <DialogContent>
      <DialogContentText>{body}</DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button variant="text" onClick={onCancel} disabled={isLoading}>
        {cancelLabel}
      </Button>
      <Button
        variant="outlined"
        color={confirmColor}
        startIcon={
          isLoading ? (
            <CircularProgress size={16} />
          ) : showDeleteIcon ? (
            <DeleteOutlineIcon />
          ) : undefined
        }
        onClick={onConfirm}
        disabled={isLoading}
      >
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
