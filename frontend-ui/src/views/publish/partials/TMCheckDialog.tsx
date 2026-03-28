import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useTranslation } from 'react-i18next';
import type { TMCheckResult } from '../types';

interface TMCheckDialogProps {
  open: boolean;
  onClose: () => void;
  result: TMCheckResult | null;
  onProceed: () => void;
}

const TMCheckDialog = ({ open, onClose, result, onProceed }: TMCheckDialogProps) => {
  const { t } = useTranslation();

  if (!result) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {result.is_clean
          ? t('publish.tm.cleanTitle')
          : t('publish.tm.flaggedTitle')}
      </DialogTitle>
      <DialogContent>
        {result.is_clean ? (
          <Typography
            variant="body1"
            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
          >
            <CheckCircleOutlineIcon color="success" />
            {t('publish.tm.cleanMessage')}
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('publish.tm.flaggedMessage')}
            </Typography>
            <List dense>
              {result.flagged_terms.map((flagged, i) => (
                <ListItem key={i}>
                  <ListItemIcon>
                    <WarningAmberIcon color="warning" />
                  </ListItemIcon>
                  <ListItemText
                    primary={flagged.term}
                    secondary={
                      <Chip
                        label={flagged.field.replace(/_/g, ' ')}
                        size="small"
                        variant="outlined"
                        sx={{ mt: 0.5 }}
                      />
                    }
                  />
                </ListItem>
              ))}
            </List>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">
          {result.is_clean ? t('publish.tm.close') : t('publish.tm.edit')}
        </Button>
        {!result.is_clean && (
          <Button onClick={onProceed} color="warning">
            {t('publish.tm.proceedAnyway')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default TMCheckDialog;
