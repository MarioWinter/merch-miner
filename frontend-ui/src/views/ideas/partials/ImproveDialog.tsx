import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import type { Idea } from '../types';

interface ImproveDialogProps {
  open: boolean;
  onClose: () => void;
  idea: Idea | null;
  onImprove: (feedback?: string) => Promise<Idea[]>;
  onSelectVariant: (variant: Idea) => void;
  isImproving: boolean;
}

const VariantCard = styled(Box, {
  shouldForwardProp: (p) => p !== 'selected',
})<{ selected?: boolean }>(({ theme, selected }) => ({
  border: `1px solid ${
    selected ? theme.vars.palette.secondary.main : alpha('#fff', 0.08)
  }`,
  borderRadius: 8,
  padding: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'border-color 150ms ease',
  '&:hover': {
    borderColor: alpha('#fff', 0.18),
  },
  ...theme.applyStyles('light', {
    border: `1px solid ${
      selected ? theme.vars.palette.secondary.main : alpha('#071E26', 0.08)
    }`,
  }),
}));

export const ImproveDialog = ({
  open,
  onClose,
  idea,
  onImprove,
  onSelectVariant,
  isImproving,
}: ImproveDialogProps) => {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState('');
  const [variants, setVariants] = useState<Idea[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );

  const handleImprove = async () => {
    const results = await onImprove(feedback || undefined);
    setVariants(results);
    setSelectedVariantId(null);
  };

  const handleSelectAndClose = () => {
    const variant = variants.find((v) => v.id === selectedVariantId);
    if (variant) {
      onSelectVariant(variant);
    }
    handleReset();
  };

  const handleReset = () => {
    setFeedback('');
    setVariants([]);
    setSelectedVariantId(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleReset}
      maxWidth="sm"
      fullWidth
      aria-labelledby="improve-dialog-title"
    >
      <DialogTitle id="improve-dialog-title">
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoFixHighIcon sx={{ fontSize: 20 }} />
          <span>{t('ideas.improve.dialogTitle')}</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {idea && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2, fontStyle: 'italic' }}
          >
            &quot;{idea.slogan_text}&quot;
          </Typography>
        )}

        {variants.length === 0 ? (
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder={t('ideas.improve.feedbackPlaceholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={isImproving}
            sx={{ mb: 1 }}
          />
        ) : (
          <Stack spacing={1}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
              {t('ideas.improve.variantsCount', { count: variants.length })}
            </Typography>
            {variants.map((v) => (
              <VariantCard
                key={v.id}
                selected={selectedVariantId === v.id}
                onClick={() => setSelectedVariantId(v.id)}
                role="option"
                aria-selected={selectedVariantId === v.id}
              >
                <Typography variant="body2">{v.slogan_text}</Typography>
                {v.why_it_works && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {v.why_it_works}
                  </Typography>
                )}
              </VariantCard>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleReset}>{t('ideas.improve.cancel')}</Button>
        {variants.length === 0 ? (
          <Button
            variant="contained"
            onClick={handleImprove}
            disabled={isImproving}
            startIcon={
              isImproving ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <AutoFixHighIcon sx={{ fontSize: 18 }} />
              )
            }
          >
            {t('ideas.improve.button')}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSelectAndClose}
            disabled={!selectedVariantId}
            startIcon={<CheckIcon sx={{ fontSize: 18 }} />}
          >
            {t('ideas.improve.selectVariant')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
