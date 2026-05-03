import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface BulkConfirmDialogProps {
  open: boolean;
  count: number;
  isSending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const BulkConfirmDialog = ({ open, count, isSending, onConfirm, onCancel }: BulkConfirmDialogProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={isSending ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{t('designs.sendToListings.cta', 'Send to Listings')}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('designs.sendToListings.bulkConfirm', { count })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={isSending}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={isSending}>
          {t('designs.sendToListings.confirm', 'Send')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkConfirmDialog;
