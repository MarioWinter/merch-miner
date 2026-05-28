import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface UpscaleOverwriteDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

/**
 * Confirmation dialog shown before re-running the AI Upscale step in the
 * Apply Pipeline flow when the target design already has an `upscaled_file`.
 * Escape + backdrop are treated as Cancel via the standard MUI onClose.
 */
const UpscaleOverwriteDialog = ({
  open,
  onCancel,
  onConfirm,
}: UpscaleOverwriteDialogProps) => {
  const { t } = useTranslation();
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="upscale-overwrite-title"
      maxWidth="xs"
      fullWidth
      slotProps={{
        paper: {
          elevation: 4,
        },
      }}
    >
      <DialogTitle id="upscale-overwrite-title">
        {t('design.upscale.overwrite.title', {
          defaultValue: 'Overwrite existing upscaled version?',
        })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('design.upscale.overwrite.body', {
            defaultValue:
              'This design already has an upscaled version. Running AI Upscale again will replace it. Continue?',
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onCancel}>
          {t('design.upscale.overwrite.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button variant="outlined" color="primary" onClick={onConfirm}>
          {t('design.upscale.overwrite.confirm', { defaultValue: 'Overwrite' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default UpscaleOverwriteDialog;
