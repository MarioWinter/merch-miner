import {
  Box,
  Typography,
  Button,
  Stack,
  CircularProgress,
  Skeleton,
  Alert,
  Divider,
  MenuItem,
  TextField,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { useTranslation } from 'react-i18next';
import type { useListingEditor } from '../hooks/useListingEditor';
import ListingField from './ListingField';
import KeywordChipsField from './KeywordChipsField';
import TranslationTabs from './TranslationTabs';

interface ListingEditorSectionProps {
  editor: ReturnType<typeof useListingEditor>;
  selectedDesignId?: string;
  onImprove?: (fieldName: string, value: string) => void;
}

const ListingEditorSection = ({
  editor,
  selectedDesignId,
  onImprove,
}: ListingEditorSectionProps) => {
  const { t } = useTranslation();
  const { listing, form, isLoadingListing, listingError } = editor;

  if (isLoadingListing) {
    return (
      <Box component="section" aria-label={t('publish.listing.title')}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          {t('publish.listing.title')}
        </Typography>
        <Stack spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={40} />
          ))}
        </Stack>
      </Box>
    );
  }

  if (listingError) {
    return (
      <Box component="section" aria-label={t('publish.listing.title')}>
        <Typography variant="h4" sx={{ mb: 3 }}>
          {t('publish.listing.title')}
        </Typography>
        <Alert severity="error">{t('publish.listing.loadError')}</Alert>
      </Box>
    );
  }

  return (
    <Box component="section" aria-label={t('publish.listing.title')}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">{t('publish.listing.title')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {!listing && (
            <Button
              variant="contained"
              startIcon={
                editor.isGenerating ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <AutoAwesomeIcon />
                )
              }
              onClick={() => editor.handleGenerate(selectedDesignId)}
              disabled={editor.isGenerating}
              sx={{
                background: 'linear-gradient(135deg, #FF5A4F 0%, #E84B42 100%)',
              }}
            >
              {t('publish.listing.generate')}
            </Button>
          )}
          {listing && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ShieldOutlinedIcon />}
                onClick={editor.handleTMCheck}
                disabled={editor.isChecking}
              >
                {t('publish.tm.check')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={editor.handleExport}
              >
                {t('publish.listing.copyMBA')}
              </Button>
            </>
          )}
        </Box>
      </Box>

      {listing && (
        <form onSubmit={form.handleSubmit(editor.handleSave)}>
          <Stack spacing={2.5}>
            <ListingField
              name="brand_name"
              label={t('publish.listing.brandName')}
              control={form.control}
              onImprove={onImprove}
            />
            <ListingField
              name="title"
              label={t('publish.listing.titleField')}
              control={form.control}
              onImprove={onImprove}
            />

            {(['bullet_1', 'bullet_2', 'bullet_3', 'bullet_4', 'bullet_5'] as const).map(
              (bullet, i) => (
                <ListingField
                  key={bullet}
                  name={bullet}
                  label={`${t('publish.listing.bullet')} ${i + 1}`}
                  control={form.control}
                  onImprove={onImprove}
                />
              ),
            )}

            <ListingField
              name="description"
              label={t('publish.listing.description')}
              control={form.control}
              multiline
              rows={4}
              onImprove={onImprove}
            />

            <KeywordChipsField control={form.control} />

            <Divider />

            {/* Availability + Publish Mode */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                select
                size="small"
                label={t('publish.listing.availability')}
                value={form.watch('availability')}
                onChange={(e) =>
                  form.setValue('availability', e.target.value as 'public' | 'private')
                }
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="public">{t('publish.listing.public')}</MenuItem>
                <MenuItem value="private">{t('publish.listing.private')}</MenuItem>
              </TextField>
              <TextField
                select
                size="small"
                label={t('publish.listing.publishMode')}
                value={form.watch('publish_mode')}
                onChange={(e) =>
                  form.setValue('publish_mode', e.target.value as 'live' | 'draft')
                }
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="live">{t('publish.listing.live')}</MenuItem>
                <MenuItem value="draft">{t('publish.listing.draft')}</MenuItem>
              </TextField>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                type="submit"
                variant="contained"
                startIcon={
                  editor.isSaving ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SaveOutlinedIcon />
                  )
                }
                disabled={editor.isSaving}
              >
                {t('publish.listing.save')}
              </Button>
            </Box>

            <Divider />

            <TranslationTabs
              listing={listing}
              isTranslating={editor.isTranslating}
              onTranslate={editor.handleTranslate}
            />
          </Stack>
        </form>
      )}

      {!listing && !editor.isGenerating && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('publish.listing.noListing')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default ListingEditorSection;
