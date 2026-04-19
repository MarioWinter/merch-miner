import { useCallback } from 'react';
import { Box, Grid, Stack } from '@mui/material';
import type { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type {
  MbaListingFormValues,
  MbaListingLanguage,
} from '../../schemas/mbaListingSchema';
import { MBA_LISTING_CHAR_LIMITS } from '../../schemas/mbaListingSchema';
import ListingField from './ListingField';
import KeywordChipsField from './KeywordChipsField';
import TranslationTabs from './TranslationTabs';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingFieldsSectionProps {
  control: Control<MbaListingFormValues>;
  activeLang: MbaListingLanguage;
  onLangChange: (lang: MbaListingLanguage) => void;
  autoTranslate: boolean;
  onAutoTranslateChange: (v: boolean) => void;
  onOptionsClick: (context: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ListingFieldsSection = ({
  control,
  activeLang,
  onLangChange,
  autoTranslate,
  onAutoTranslateChange,
  onOptionsClick,
}: ListingFieldsSectionProps) => {
  const { t } = useTranslation();

  const handleAiImprove = useCallback((value: string) => {
    // PROJ-17 Chat wiring is deferred — stub for D5
    console.log('[ListingFieldsSection] AI improve:', value);
  }, []);

  const handleTranslateToAll = useCallback((targetLang: MbaListingLanguage) => {
    // Real translate call happens in D6/D7 — log for D5
    console.log('[ListingFieldsSection] translate to all:', targetLang);
  }, []);

  return (
    <Box component="section" aria-label={t('publish.edit.fields.sectionLabel', {
      defaultValue: 'Listing Fields',
    })}>
      <TranslationTabs
        activeLang={activeLang}
        onLangChange={onLangChange}
        autoTranslate={autoTranslate}
        onAutoTranslateChange={onAutoTranslateChange}
        onTranslateToAll={handleTranslateToAll}
      />

      <Stack gap={2}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="brand"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.brand}
              label={t('publish.edit.fields.brand', { defaultValue: 'Brand' })}
              context="brand"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="title"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.title}
              label={t('publish.edit.fields.title', { defaultValue: 'Title' })}
              context="title"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="bullet_1"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_1}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 1,
              })}
              multiline
              rows={2}
              context="bullet_1"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="bullet_2"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_2}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 2,
              })}
              multiline
              rows={2}
              context="bullet_2"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="bullet_3"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_3}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 3,
              })}
              multiline
              rows={2}
              context="bullet_3"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="bullet_4"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_4}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 4,
              })}
              multiline
              rows={2}
              context="bullet_4"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              name="bullet_5"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_5}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 5,
              })}
              multiline
              rows={2}
              context="bullet_5"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }} />

          <Grid size={{ xs: 12 }}>
            <ListingField
              name="description"
              control={control}
              maxChars={MBA_LISTING_CHAR_LIMITS.description}
              label={t('publish.edit.fields.description', {
                defaultValue: 'Description',
              })}
              multiline
              rows={8}
              context="description"
              onOptionsClick={onOptionsClick}
              onAiImprove={handleAiImprove}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <KeywordChipsField
              name="backend_keywords"
              control={control}
              context="keywords"
              onOptionsClick={onOptionsClick}
            />
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
};

export default ListingFieldsSection;
