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

interface PreflightQuotaDialogProps {
  open: boolean;
  /** Number of designs the user attempted to submit. */
  selectedCount: number;
  /** Quota remaining for this calendar month. */
  remaining: number;
  /** ISO date string when the user's quota resets. */
  resetsOn: string;
  onCancel: () => void;
  onConfirmFirstN: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const PreflightQuotaDialog = ({
  open,
  selectedCount,
  remaining,
  resetsOn,
  onCancel,
  onConfirmFirstN,
}: PreflightQuotaDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="preflight-quota-title"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="preflight-quota-title">
        {t('upscale.preflight.title', {
          defaultValue: 'Selection exceeds your monthly quota',
        })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('upscale.preflight.body', {
            defaultValue:
              'You selected {{count}} designs but only {{remaining}} upscales remain this month (resets {{resets_on}}).',
            count: selectedCount,
            remaining,
            resets_on: resetsOn,
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onCancel} color="inherit">
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onConfirmFirstN}
          disabled={remaining <= 0}
        >
          {t('upscale.preflight.confirmFirstN', {
            defaultValue: 'Upscale first {{remaining}} only',
            remaining,
          })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PreflightQuotaDialog;
