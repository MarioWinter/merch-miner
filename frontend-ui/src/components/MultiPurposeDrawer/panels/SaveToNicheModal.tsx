import { useMemo, useState } from 'react';
import {
  Autocomplete,
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
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useListNichesQuery } from '@/store/nicheSlice';
import {
  useSaveSnippetToNicheMutation,
} from '@/store/searchSlice';
import type { Niche } from '@/views/niches/list/types';
import type {
  SaveSnippetKeywordsResponse,
  SaveSnippetNotesResponse,
  SaveSnippetResponse,
} from '@/types/search';

interface SaveToNicheModalProps {
  open: boolean;
  onClose: () => void;
  selectedText: string;
  saveAs: 'keywords' | 'notes';
  sourceUrl?: string;
  onSaved?: () => void;
}

/** Truncate to fit a one-paragraph preview without overwhelming the modal. */
const PREVIEW_MAX = 200;

const PreviewBlock = styled(Box)(({ theme }) => ({
  padding: `${theme.spacing(1)} ${theme.spacing(1.25)}`,
  borderRadius: 8,
  backgroundColor: alpha(theme.palette.background.paper, 0.5),
  border: `1px solid ${theme.vars.palette.divider}`,
  fontSize: '0.8125rem',
  lineHeight: 1.5,
  color: theme.vars.palette.text.secondary,
  fontStyle: 'italic',
  maxHeight: 96,
  overflowY: 'auto',
}));

const isKeywordsResponse = (
  res: SaveSnippetResponse,
  saveAs: 'keywords' | 'notes',
): res is SaveSnippetKeywordsResponse => saveAs === 'keywords';

const isNotesResponse = (
  res: SaveSnippetResponse,
  saveAs: 'keywords' | 'notes',
): res is SaveSnippetNotesResponse => saveAs === 'notes';

const SaveToNicheModal = ({
  open,
  onClose,
  selectedText,
  saveAs,
  sourceUrl,
  onSaved,
}: SaveToNicheModalProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);

  // Fetch niches in current workspace — first page is enough for autocomplete
  const { data: nichesData, isLoading: nichesLoading } = useListNichesQuery(
    { page_size: 200 },
    { skip: !open },
  );
  const niches = useMemo(() => nichesData?.results ?? [], [nichesData]);

  const [saveSnippet, { isLoading: saving }] = useSaveSnippetToNicheMutation();

  const preview = useMemo(() => {
    if (selectedText.length <= PREVIEW_MAX) return selectedText;
    return `${selectedText.slice(0, PREVIEW_MAX - 1)}…`;
  }, [selectedText]);

  const handleClose = () => {
    setSelectedNiche(null);
    onClose();
  };

  const handleSave = async () => {
    if (!selectedNiche) return;
    try {
      const result = await saveSnippet({
        nicheId: selectedNiche.id,
        body: {
          selected_text: selectedText,
          save_as: saveAs,
          ...(sourceUrl ? { source_url: sourceUrl } : {}),
        },
      }).unwrap();

      if (saveAs === 'keywords' && isKeywordsResponse(result, saveAs)) {
        if (result.created > 0) {
          enqueueSnackbar(
            t('search.save.successKeywords', { count: result.created }),
            { variant: 'success' },
          );
        } else {
          enqueueSnackbar(t('search.save.allDuplicates'), { variant: 'info' });
        }
      } else if (saveAs === 'notes' && isNotesResponse(result, saveAs)) {
        enqueueSnackbar(t('search.save.successNote'), { variant: 'success' });
      }
      onSaved?.();
      handleClose();
    } catch {
      enqueueSnackbar(t('search.save.errorGeneric'), { variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        if (saving && reason === 'backdropClick') return;
        handleClose();
      }}
      maxWidth="xs"
      fullWidth
      aria-labelledby="save-to-niche-title"
    >
      <DialogTitle id="save-to-niche-title">
        {t('search.save.modal.title')}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t('search.save.modal.description', {
              type:
                saveAs === 'keywords'
                  ? t('search.save.toKeywords').toLowerCase()
                  : t('search.save.toNotes').toLowerCase(),
            })}
          </Typography>

          <PreviewBlock>{preview}</PreviewBlock>

          <Autocomplete
            options={niches}
            value={selectedNiche}
            onChange={(_e, value) => setSelectedNiche(value)}
            loading={nichesLoading}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            noOptionsText={t('search.save.modal.noNiches')}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder={t('search.save.modal.nichePlaceholder')}
                size="small"
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {nichesLoading ? (
                          <CircularProgress size={16} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={handleClose} disabled={saving}>
          {t('search.save.modal.cancel')}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={!selectedNiche || saving}
          startIcon={saving ? <CircularProgress size={14} /> : undefined}
        >
          {t('search.save.modal.save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveToNicheModal;
