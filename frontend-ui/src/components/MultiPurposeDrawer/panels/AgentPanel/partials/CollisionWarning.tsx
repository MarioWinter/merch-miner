import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useTranslation } from 'react-i18next';

interface CollisionWarningProps {
  open: boolean;
  username: string;
  nicheName: string;
  onContinue: () => void;
  onCancel: () => void;
}

const CollisionWarning = ({
  open,
  username,
  nicheName,
  onContinue,
  onCancel,
}: CollisionWarningProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={(_e, reason) => reason !== 'backdropClick' && onCancel()}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningAmberIcon color="warning" />
        {t('agent.collision.title')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t('agent.collision.message', { username, nicheName })}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="outlined">
          {t('agent.collision.cancel')}
        </Button>
        <Button onClick={onContinue} variant="contained">
          {t('agent.collision.continue')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CollisionWarning;
