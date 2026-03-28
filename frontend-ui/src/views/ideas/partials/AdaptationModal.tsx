import { useCallback, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import { NicheSuggestionList } from './NicheSuggestionList';
import { useNicheSuggestions } from '../hooks/useNicheSuggestions';
import type { Idea } from '../types';

interface AdaptationModalProps {
  open: boolean;
  onClose: () => void;
  sourceIdea: Idea | null;
  onConfirm: (targetNicheIds: string[]) => void;
  isTriggering: boolean;
}

export const AdaptationModal = ({
  open,
  onClose,
  sourceIdea,
  onConfirm,
  isTriggering,
}: AdaptationModalProps) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { suggestions, isLoading, availableNiches, autoSelectTop5 } =
    useNicheSuggestions(open && sourceIdea ? sourceIdea.id : null);

  // Reset selection via Dialog's TransitionProps (fires on enter, not in effect)
  const handleEnter = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleToggle = useCallback((nicheId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nicheId)) {
        next.delete(nicheId);
      } else {
        next.add(nicheId);
      }
      return next;
    });
  }, []);

  const handleAutoSelect = useCallback(() => {
    setSelectedIds(new Set(autoSelectTop5()));
  }, [autoSelectTop5]);

  const handleConfirm = () => {
    onConfirm(Array.from(selectedIds));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="adaptation-modal-title"
      slotProps={{ transition: { onEnter: handleEnter } }}
    >
      <DialogTitle id="adaptation-modal-title">
        <Stack direction="row" alignItems="center" spacing={1}>
          <AutoAwesomeIcon color="secondary" sx={{ fontSize: 20 }} />
          <span>{t('ideas.adapt.modalTitle')}</span>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {sourceIdea && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('ideas.adapt.source')}: &quot;{sourceIdea.slogan_text}&quot;
          </Typography>
        )}

        {/* Niche warning when no research */}
        {!isLoading && suggestions.some((s) => !s.shared_patterns.length) && (
          <Typography variant="caption" color="warning.main" sx={{ mb: 1 }}>
            {t('ideas.niche.noResearchWarning')}
          </Typography>
        )}

        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 1.5 }}
        >
          <Typography variant="subtitle2">
            {t('ideas.adapt.selectTargets')}
          </Typography>
          <Button
            size="small"
            onClick={handleAutoSelect}
            disabled={availableNiches.length === 0}
          >
            {t('ideas.adapt.autoSelect')}
          </Button>
        </Stack>

        <NicheSuggestionList
          suggestions={suggestions}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          isLoading={isLoading}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isTriggering}>
          {t('ideas.adapt.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedIds.size === 0 || isTriggering}
          startIcon={
            isTriggering ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <AutoAwesomeIcon sx={{ fontSize: 18 }} />
            )
          }
        >
          {t('ideas.adapt.confirm')} ({selectedIds.size})
        </Button>
      </DialogActions>
    </Dialog>
  );
};
