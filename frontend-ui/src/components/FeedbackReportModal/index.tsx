import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';

import ConfirmDialog from '../ConfirmDialog';
import FeedbackForm from './partials/FeedbackForm';
import { useFeedbackReport } from './hooks/useFeedbackReport';

const StyledDialog = styled(Dialog)({
  '& .MuiDialog-paper': {
    width: '100%',
    maxWidth: 480,
  },
});

const TitleRow = styled(DialogTitle)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
  paddingRight: theme.spacing(2),
}));

export interface FeedbackReportModalProps {
  open: boolean;
  onClose: () => void;
}

const FeedbackReportModal = ({ open, onClose }: FeedbackReportModalProps) => {
  const { t } = useTranslation();
  const prefersReducedMotion = useMediaQuery(
    '(prefers-reduced-motion: reduce)',
  );
  const [discardOpen, setDiscardOpen] = useState(false);

  const {
    form,
    onSubmit,
    isSubmitting,
    isDirty,
    reset,
    screenshot,
    setScreenshotFile,
    screenshotError,
    setScreenshotError,
  } = useFeedbackReport({ onSuccess: onClose });

  const handleClose = () => {
    if (isSubmitting) return;
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const handleConfirmDiscard = () => {
    reset();
    setDiscardOpen(false);
    onClose();
  };

  const handleCancelDiscard = () => {
    setDiscardOpen(false);
  };

  const submitDisabled =
    isSubmitting ||
    !form.formState.isValid ||
    Boolean(screenshotError);

  return (
    <>
      <StyledDialog
        open={open}
        onClose={handleClose}
        aria-labelledby="feedback-modal-title"
        // Disable entrance/exit transition when the user prefers reduced
        // motion. MUI uses a 0-duration transition to skip animations
        // without breaking the open/close lifecycle.
        transitionDuration={prefersReducedMotion ? 0 : undefined}
      >
        <TitleRow id="feedback-modal-title">
          {t('feedback.modal.title')}
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label={t('feedback.modal.closeAria')}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </TitleRow>
        <form onSubmit={onSubmit} noValidate>
          <DialogContent dividers>
            <FeedbackForm
              form={form}
              disabled={isSubmitting}
              screenshot={screenshot}
              screenshotError={screenshotError}
              onScreenshotChange={setScreenshotFile}
              onScreenshotError={setScreenshotError}
            />
          </DialogContent>
          <DialogActions>
            <Button
              variant="text"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('feedback.form.cancel')}
            </Button>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={submitDisabled}
              startIcon={
                isSubmitting ? <CircularProgress size={16} /> : undefined
              }
            >
              {t('feedback.form.submit')}
            </Button>
          </DialogActions>
        </form>
      </StyledDialog>

      <ConfirmDialog
        open={discardOpen}
        title={t('feedback.discard.title')}
        body={t('feedback.discard.message')}
        confirmLabel={t('feedback.discard.confirm')}
        cancelLabel={t('feedback.discard.cancel')}
        confirmColor="error"
        showDeleteIcon={false}
        onConfirm={handleConfirmDiscard}
        onCancel={handleCancelDiscard}
      />
    </>
  );
};

export default FeedbackReportModal;
