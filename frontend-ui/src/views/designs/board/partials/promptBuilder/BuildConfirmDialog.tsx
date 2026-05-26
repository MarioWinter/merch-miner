// PROJ-34 Phase 8 — generic confirm dialog used for two scenarios:
//   AC-35 / EC-11 — "About to generate >30 prompts"
//   AC-40 / EC-12 — "Replace your manual edits?"
// Primary action uses `color="primary"` (red) on purpose — high-impact signal.

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

interface BuildConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const BuildConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onCancel,
  onConfirm,
}: BuildConfirmDialogProps) => (
  <Dialog
    open={open}
    onClose={onCancel}
    maxWidth="xs"
    fullWidth
    aria-labelledby="builder-confirm-title"
  >
    <DialogTitle id="builder-confirm-title">{title}</DialogTitle>
    <DialogContent dividers sx={{ whiteSpace: 'pre-line' }}>
      {body}
    </DialogContent>
    <DialogActions>
      <Button color="inherit" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button variant="contained" color="primary" onClick={onConfirm} autoFocus>
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default BuildConfirmDialog;
