import { useCallback } from 'react';
import { Box, Grid, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MbaListingLanguage } from '../../schemas/mbaListingSchema';
import { MBA_LISTING_CHAR_LIMITS } from '../../schemas/mbaListingSchema';
import type { Listing } from '../../types';
import type {
  TextField as ListingTextField,
  TranslatableField,
  UseEditFormStateReturn,
} from '../../hooks/useEditFormState';
import { TRANSLATABLE_FIELDS } from '../../hooks/useEditFormState';
import ListingField from './ListingField';
import KeywordContextField from '../editor/KeywordContextField';
import TranslationTabs from './TranslationTabs';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ListingFieldsSectionProps {
  /** Server-side Listing — drives the controlled inputs and the
   *  on-blur-if-dirty comparison inside `textSetters.onBlur`. */
  listing: Listing | null;
  textSetters: UseEditFormStateReturn['textSetters'];
  activeLang: MbaListingLanguage;
  onLangChange: (lang: MbaListingLanguage) => void;
  autoTranslate: boolean;
  onAutoTranslateChange: (v: boolean) => void;
  /** Phase P7 — list of field names the server truncated on the last
   *  AI-Improve run. Renders an inline "AI truncated" chip on the
   *  matching `ListingField`. */
  truncatedFields?: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ListingFieldsSection = ({
  listing,
  textSetters,
  activeLang,
  onLangChange,
  autoTranslate,
  onAutoTranslateChange,
  truncatedFields,
}: ListingFieldsSectionProps) => {
  const { t } = useTranslation();

  const handleTranslateToAll = useCallback(
    (_targetLang: MbaListingLanguage) => {
      // Real translate call happens elsewhere; kept as a stub wired via
      // TranslationTabs so the component stays pure.
      void _targetLang;
    },
    [],
  );

  // Single factory for ListingField bindings so we don't repeat the
  // field-name literal on both onChange and onBlur. Also flips the
  // `truncated` chip on/off based on the last AI-Improve result.
  //
  // Per-language wire-up (Round 5): when `activeLang !== 'en'`, translatable
  // fields (title / bullet_1 / bullet_2 / description) read from and write
  // to `listing.translations[activeLang][field]`. Brand + keyword_context
  // stay on the top-level regardless of language — per AC-9, keyword_context
  // is AI-input-only (not translated), and brand_name is global on MBA.
  const truncatedSet = new Set(truncatedFields ?? []);
  const isEn = activeLang === 'en';
  const translatable = (field: ListingTextField): field is TranslatableField =>
    (TRANSLATABLE_FIELDS as readonly string[]).includes(field);
  const bind = (field: ListingTextField, key: keyof Listing) => {
    if (!isEn && translatable(field)) {
      const tr =
        (listing?.translations?.[activeLang] as
          | Record<TranslatableField, string>
          | undefined) ?? undefined;
      return {
        value: tr?.[field] ?? '',
        onChange: (v: string) =>
          textSetters.onChangeTranslated(activeLang, field, v),
        onBlur: (v: string) =>
          textSetters.onBlurTranslated(activeLang, field, v),
        truncated: false,
      };
    }
    return {
      value: (listing?.[key] as string | undefined) ?? '',
      onChange: (v: string) => textSetters.onChange(field, v),
      onBlur: (v: string) => textSetters.onBlur(field, v),
      truncated: truncatedSet.has(field),
    };
  };

  return (
    <Box
      component="section"
      aria-label={t('publish.edit.fields.sectionLabel', {
        defaultValue: 'Listing Fields',
      })}
    >
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
              {...bind('brand_name', 'brand_name')}
              maxChars={MBA_LISTING_CHAR_LIMITS.brand}
              label={t('publish.edit.fields.brand', { defaultValue: 'Brand' })}
              disabled={!isEn}
              disabledReason={t('publish.edit.translation.notLocalized', {
                defaultValue: 'Brand is the same across languages — edit on the EN tab',
              })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              {...bind('title', 'title')}
              maxChars={MBA_LISTING_CHAR_LIMITS.title}
              label={t('publish.edit.fields.title', { defaultValue: 'Title' })}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              {...bind('bullet_1', 'bullet_1')}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_1}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 1,
              })}
              multiline
              rows={2}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ListingField
              {...bind('bullet_2', 'bullet_2')}
              maxChars={MBA_LISTING_CHAR_LIMITS.bullet_2}
              label={t('publish.edit.fields.bullet', {
                defaultValue: 'Bullet {{n}}',
                n: 2,
              })}
              multiline
              rows={2}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <ListingField
              {...bind('description', 'description')}
              maxChars={MBA_LISTING_CHAR_LIMITS.description}
              label={t('publish.edit.fields.description', {
                defaultValue: 'Description',
              })}
              multiline
              rows={8}
            />
          </Grid>

          <Grid size={{ xs: 12 }}>
            <KeywordContextField
              {...bind('keyword_context', 'keyword_context')}
              disabled={!isEn}
              disabledReason={t('publish.edit.translation.notLocalized', {
                defaultValue: 'Brand is the same across languages — edit on the EN tab',
              })}
            />
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
};

export default ListingFieldsSection;
