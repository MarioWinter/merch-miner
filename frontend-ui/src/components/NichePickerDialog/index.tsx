/**
 * PROJ-29 Phase 1H-2 — standalone niche picker dialog.
 *
 * Used by `useAddSloganToNiche` when the chat session has no `niche_context`
 * and the workspace has > 1 niche. Returns the picked nicheId via `onConfirm`.
 *
 * Deliberately separate from `SaveToNicheModal` — that modal is tightly bound
 * to the save-snippet (keywords/notes) flow; this one is a generic picker.
 */
import { useMemo, useState } from 'react';
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useListNichesQuery } from '@/store/nicheSlice';

interface NicheOption {
  id: string;
  name: string;
}

interface NichePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (nicheId: string) => void;
  title?: string;
  confirmLabel?: string;
}

const NichePickerDialog = ({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel,
}: NichePickerDialogProps) => {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<NicheOption | null>(null);

  const { data, isLoading } = useListNichesQuery(
    { page_size: 200 },
    { skip: !open },
  );
  const niches = useMemo<NicheOption[]>(
    () => data?.results?.map((n) => ({ id: n.id, name: n.name })) ?? [],
    [data],
  );

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm(selected.id);
    handleClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      fullWidth
      aria-labelledby="niche-picker-title"
    >
      <DialogTitle id="niche-picker-title">
        {title ?? t('chatNicheRag.nichePicker.title')}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 0.5 }}>
          {isLoading ? (
            <Skeleton variant="rounded" height={40} />
          ) : niches.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('chatNicheRag.nichePicker.empty')}
            </Typography>
          ) : (
            <Autocomplete
              options={niches}
              value={selected}
              onChange={(_e, value) => setSelected(value)}
              getOptionLabel={(option) => option.name}
              isOptionEqualToValue={(opt, val) => opt.id === val.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  autoFocus
                  placeholder={t('chatNicheRag.nichePicker.placeholder')}
                  size="small"
                />
              )}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} variant="text">
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={!selected}
          variant="contained"
          color="primary"
        >
          {confirmLabel ?? t('chatNicheRag.nichePicker.confirmLabel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NichePickerDialog;
