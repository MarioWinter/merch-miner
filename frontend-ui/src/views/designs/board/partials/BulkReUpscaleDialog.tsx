import { useEffect, useRef } from 'react';
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

interface BulkReUpscaleDialogProps {
  open: boolean;
  alreadyUpscaledCount: number;
  totalCount: number;
  onCancel: () => void;
  onSkipAlreadyUpscaled: () => void;
  onReupscaleAll: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const BulkReUpscaleDialog = ({
  open,
  alreadyUpscaledCount,
  totalCount,
  onCancel,
  onSkipAlreadyUpscaled,
  onReupscaleAll,
}: BulkReUpscaleDialogProps) => {
  const { t } = useTranslation();
  const skipBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus the safer "Skip" button when the dialog opens (default focus per spec).
  useEffect(() => {
    if (open) skipBtnRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="bulk-reupscale-title"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="bulk-reupscale-title">
        {t('upscale.bulk.reupscaleTitle', {
          defaultValue: 'Some designs have already been upscaled',
        })}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('upscale.bulk.reupscaleBody', {
            defaultValue:
              '{{count}} of {{total}} selected designs already have an upscaled version. How do you want to proceed?',
            count: alreadyUpscaledCount,
            total: totalCount,
          })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onCancel} color="inherit">
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="text"
          onClick={onSkipAlreadyUpscaled}
          ref={skipBtnRef}
        >
          {t('upscale.bulk.skipAlreadyUpscaled', {
            defaultValue: 'Skip already upscaled',
          })}
        </Button>
        <Button variant="contained" color="primary" onClick={onReupscaleAll}>
          {t('upscale.bulk.reupscaleAll', { defaultValue: 'Re-upscale all' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkReUpscaleDialog;
