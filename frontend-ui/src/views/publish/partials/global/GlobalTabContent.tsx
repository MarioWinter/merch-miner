import { Box, Grid, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ConfirmDialog';
import type {
  Listing,
  ListingColorMode,
  ListingLanguage,
  ListingTypeFlag,
  MbaColor,
} from '../../types';
import { LISTING_CHAR_LIMITS } from '../../types';
import type {
  TextField as ListingTextField,
  TranslatableField,
  UseEditFormStateReturn,
} from '../../hooks/useEditFormState';
import { TRANSLATABLE_FIELDS } from '../../hooks/useEditFormState';
import type { MbaListingLanguage } from '../../schemas/mbaListingSchema';
import { useGlobalTabActions } from '../../hooks/useGlobalTabActions';
import ListingField from '../edit/ListingField';
import TranslationTabs from '../edit/TranslationTabs';
import KeywordsChipField from './KeywordsChipField';
import KeywordResearchLinks from './KeywordResearchLinks';
import TypeColorOptions from './TypeColorOptions';
import TaggingOptionsMenu from './TaggingOptionsMenu';
import ImportKeywordsCsvDialog from './ImportKeywordsCsvDialog';
import AdvancedOptionsDialog from './AdvancedOptionsDialog';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const HeaderRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: theme.spacing(1),
}));

const HeaderDivider = styled('span')(({ theme }) => ({
  width: 1,
  height: theme.spacing(2.5),
  backgroundColor: theme.vars.palette.divider,
  display: 'inline-block',
}));

// Per AC-88, Global Options section sits below the listing fields -- this
// provides a shallow visual container for the Types + Color group.
const OptionsWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

const AdvancedOptionsTriggerButton = styled('button')(({ theme }) => ({
  background: 'none',
  border: 'none',
  padding: theme.spacing(0.25, 1),
  cursor: 'pointer',
  font: 'inherit',
  color: theme.vars.palette.primary.main,
  '&:disabled': {
    color: theme.vars.palette.text.disabled,
    cursor: 'not-allowed',
  },
  '&:hover:not(:disabled)': {
    textDecoration: 'underline',
  },
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface GlobalTabContentProps {
  listing: Listing | null;
  activeLang: ListingLanguage;
  onLangChange: (lang: ListingLanguage) => void;
  autoTranslate: boolean;
  onAutoTranslateChange: (value: boolean) => void;
  /** Inherited niche UUID for the design -- drives KW Finder deeplink. */
  activeNicheId: string | null;
  textSetters: UseEditFormStateReturn['textSetters'];
  keywordsSetters: UseEditFormStateReturn['keywordsSetters'];
  typeFlagsSetter: UseEditFormStateReturn['typeFlagsSetter'];
  colorModeSetter: UseEditFormStateReturn['colorModeSetter'];
  advancedOptionsSetter: UseEditFormStateReturn['advancedOptionsSetter'];
  /** Disable every mutating control when no Global listing exists yet (per
   *  AC-108 the first PATCH should lazy-create the row; until that lands we
   *  gate the UI so the user understands they need to Convert-from-MBA). */
  listingReady: boolean;
  /** Reserved for a future Global-level palette picker. */
  colorOptions?: MbaColor[];
}

// ---------------------------------------------------------------------------
// Component — Phase U8 composition
//
// Renders the full Global marketplace tab: Translation tabs + Title +
// Description (AC-42) + Keywords chip field (AC-84/85) + KW research links
// (AC-128/129) + Options section (Types + Color -- AC-88) + header buttons
// (Tagging Options -- AC-134, Advanced Options -- AC-130).
//
// Intentionally does NOT render Brand / Bullets / keyword_context / MBA
// product config / AI Improve (AC-45). Brand lives inside the Advanced
// Options modal (AC-131).
// ---------------------------------------------------------------------------

const GlobalTabContent = ({
  listing,
  activeLang,
  onLangChange,
  autoTranslate,
  onAutoTranslateChange,
  activeNicheId,
  textSetters,
  keywordsSetters,
  typeFlagsSetter,
  colorModeSetter,
  advancedOptionsSetter,
  listingReady,
}: GlobalTabContentProps) => {
  const { t } = useTranslation();
  const actions = useGlobalTabActions({
    listing,
    activeLang,
    keywordsSetters,
  });

  const keywordsForLang = listing?.keywords?.[activeLang] ?? [];
  const typeFlags = (listing?.type_flags ?? []) as ListingTypeFlag[];
  const colorMode = (listing?.color_mode ?? '') as ListingColorMode;

  const disabledBecauseNoListing = !listingReady;
  const disabledReason = disabledBecauseNoListing
    ? t('publish.edit.global.noListing', {
        defaultValue:
          'Generate a Global listing (Convert from MBA) before editing Global fields.',
      })
    : undefined;

  // ---- Title + Description bindings (language-aware, mirrors the MBA
  //      ListingFieldsSection pattern but scoped to just these 2 fields) ----
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
      };
    }
    return {
      value: (listing?.[key] as string | undefined) ?? '',
      onChange: (v: string) => textSetters.onChange(field, v),
      onBlur: (v: string) => textSetters.onBlur(field, v),
    };
  };

  // ---- Handlers -------------------------------------------------------
  const handleCommit = async (kw: string) => {
    await keywordsSetters.commitChip(activeLang, kw);
  };
  const handleRemove = async (idx: number) => {
    await keywordsSetters.removeChip(activeLang, idx);
  };

  const handleTagging = {
    copyEn: () => actions.openConfirm('copyEn'),
    clearAll: () => actions.openConfirm('clearAll'),
    importCsv: () => actions.openImport(),
  };

  const handleAdvancedSave = async (brand: string, category: string) => {
    await advancedOptionsSetter(brand, category);
    actions.closeAdvanced();
  };

  return (
    <Box
      component="section"
      data-testid="GlobalTabContent"
      aria-label={t('publish.edit.global.sectionLabel', {
        defaultValue: 'Global listing',
      })}
    >
      {/* Header -- Tagging Options menu + Advanced Options text link */}
      <HeaderRow>
        <TaggingOptionsMenu
          disabled={disabledBecauseNoListing}
          onCopyEnToAll={handleTagging.copyEn}
          onClearAll={handleTagging.clearAll}
          onImportCsv={handleTagging.importCsv}
        />
        <HeaderDivider aria-hidden />
        <AdvancedOptionsTriggerButton
          type="button"
          onClick={actions.openAdvanced}
          disabled={disabledBecauseNoListing}
          data-testid="AdvancedOptionsTrigger"
        >
          {t('publish.edit.global.advanced.trigger', {
            defaultValue: 'Advanced Options',
          })}
        </AdvancedOptionsTriggerButton>
      </HeaderRow>

      {/* Translation tabs -- shared with the MBA tab UX */}
      <TranslationTabs
        activeLang={activeLang as MbaListingLanguage}
        onLangChange={(lang) => onLangChange(lang as ListingLanguage)}
        autoTranslate={autoTranslate}
        onAutoTranslateChange={onAutoTranslateChange}
        onTranslateToAll={() => undefined}
      />

      <Stack gap={3}>
        {/* Title + Description (AC-42 + AC-53 -- MBA limits 60 / 2000) */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <ListingField
              {...bind('title', 'title')}
              maxChars={LISTING_CHAR_LIMITS.title}
              label={t('publish.edit.fields.title', { defaultValue: 'Title' })}
              disabled={disabledBecauseNoListing}
              disabledReason={disabledReason}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <ListingField
              {...bind('description', 'description')}
              maxChars={LISTING_CHAR_LIMITS.description}
              label={t('publish.edit.fields.description', {
                defaultValue: 'Description',
              })}
              multiline
              rows={8}
              disabled={disabledBecauseNoListing}
              disabledReason={disabledReason}
            />
          </Grid>
        </Grid>

        {/* Keywords chip field + research deep-links */}
        <Box>
          <KeywordsChipField
            value={keywordsForLang}
            lang={activeLang}
            onCommit={handleCommit}
            onRemove={handleRemove}
            disabled={disabledBecauseNoListing}
            disabledReason={disabledReason}
          />
          <KeywordResearchLinks nicheId={activeNicheId} />
        </Box>

        {/* Options -- Types + Color (Global-only) */}
        <OptionsWrapper>
          <TypeColorOptions
            typeFlags={typeFlags}
            colorMode={colorMode}
            onTypeFlagsChange={typeFlagsSetter}
            onColorModeChange={colorModeSetter}
            disabled={disabledBecauseNoListing}
          />
        </OptionsWrapper>
      </Stack>

      {/* Copy EN -> all -- confirm */}
      <ConfirmDialog
        open={actions.confirm === 'copyEn'}
        title={t('publish.edit.global.tagging.copyEnConfirmTitle', {
          defaultValue: 'Copy EN keywords to all languages?',
        })}
        body={t('publish.edit.global.tagging.copyEnConfirmBody', {
          defaultValue:
            'Replaces keyword lists for DE, FR, IT, ES, JA with the EN list. Existing entries in those languages will be overwritten.',
        })}
        confirmLabel={t('publish.edit.global.tagging.copyEnConfirm', {
          defaultValue: 'Copy',
        })}
        cancelLabel={t('publish.edit.global.tagging.cancel', {
          defaultValue: 'Cancel',
        })}
        confirmColor="primary"
        showDeleteIcon={false}
        onConfirm={() => void actions.runCopyEnToAll()}
        onCancel={actions.closeConfirm}
      />

      {/* Clear all -- confirm */}
      <ConfirmDialog
        open={actions.confirm === 'clearAll'}
        title={t('publish.edit.global.tagging.clearAllConfirmTitle', {
          defaultValue: 'Clear all keywords?',
        })}
        body={t('publish.edit.global.tagging.clearAllConfirmBody', {
          defaultValue:
            'Removes every keyword across every language on this listing. This cannot be undone.',
        })}
        confirmLabel={t('publish.edit.global.tagging.clearAllConfirm', {
          defaultValue: 'Clear all',
        })}
        cancelLabel={t('publish.edit.global.tagging.cancel', {
          defaultValue: 'Cancel',
        })}
        confirmColor="error"
        showDeleteIcon
        onConfirm={() => void actions.runClearAll()}
        onCancel={actions.closeConfirm}
      />

      <ImportKeywordsCsvDialog
        open={actions.importOpen}
        activeLang={activeLang}
        existingKeywords={keywordsForLang}
        onClose={actions.closeImport}
        onCommit={actions.runImportCsv}
      />

      <AdvancedOptionsDialog
        open={actions.advancedOpen}
        defaultBrand={listing?.brand_name ?? ''}
        defaultCategory={listing?.category ?? ''}
        onClose={actions.closeAdvanced}
        onSave={handleAdvancedSave}
      />
    </Box>
  );
};

export default GlobalTabContent;
