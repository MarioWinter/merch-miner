import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Autocomplete,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useListNichesQuery } from '@/store/nicheSlice';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, nicheId?: string) => void;
  isSubmitting: boolean;
}

interface NicheOption {
  id: string;
  name: string;
}

const CreateProjectDialog = ({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateProjectDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedNiche, setSelectedNiche] = useState<NicheOption | null>(null);

  const { data: nicheData, isLoading: nichesLoading } = useListNichesQuery(
    { page_size: 200 },
    { skip: !open },
  );

  const nicheOptions: NicheOption[] =
    nicheData?.results.map((n) => ({ id: n.id, name: n.name })) ?? [];

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, selectedNiche?.id);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setName('');
    setSelectedNiche(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={(_event, reason) => {
        if (reason === 'backdropClick' && isSubmitting) return;
        handleClose();
      }}
      maxWidth="sm"
      fullWidth
      aria-labelledby="create-project-dialog-title"
    >
      <DialogTitle id="create-project-dialog-title">
        {t('design.projects.createDialog.title')}
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>
        <TextField
          autoFocus
          label={t('design.projects.createDialog.nameLabel')}
          placeholder={t('design.projects.createDialog.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          disabled={isSubmitting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) handleSubmit();
          }}
        />

        <Autocomplete
          options={nicheOptions}
          getOptionLabel={(option) => option.name}
          value={selectedNiche}
          onChange={(_e, value) => setSelectedNiche(value)}
          loading={nichesLoading}
          disabled={isSubmitting}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t('design.projects.createDialog.nicheLabel')}
              placeholder={t('design.projects.createDialog.nichePlaceholder')}
              slotProps={{
                input: {
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {nichesLoading && <CircularProgress size={20} />}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          {t('design.projects.createDialog.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!name.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            t('design.projects.createDialog.confirm')
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateProjectDialog;
