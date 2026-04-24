import { Box, Grid, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ConfirmDialog from '@/components/ConfirmDialog';
import type {
  Listing,
  ListingLanguage,
  ListingTypeFlag,
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
import BackgroundColorPicker from './BackgroundColorPicker';

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

export interface DisplateTabContentProps {
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
  bgHexSetter: UseEditFormStateReturn['bgHexSetter'];
  advancedOptionsSetter: UseEditFormStateReturn['advancedOptionsSetter'];
  /** Disable mutating controls when no Displate listing exists yet. Per
   *  AC-126 the first PATCH lazy-creates the listing, so until that lands
   *  we gate the UI -- same pattern as GlobalTabContent. */
  listingReady: boolean;
}

// ---------------------------------------------------------------------------
// Component — Phase V2 (AC-123 / AC-125 / AC-126)
//
// Renders the full Displate marketplace tab: Translation tabs + Title +
// Description + Keywords chip field + KW research links + Options section
// (Types checkboxes + Background Color hex picker) + header buttons (Tagging
// Options + Advanced Options without Category).
//
// Delta vs GlobalTabContent:
//  - No `color_mode` radio (Displate = background hex, not design palette).
//  - Adds `BackgroundColorPicker` wired to `bgHexSetter`.
//  - `AdvancedOptionsDialog` rendered with `hideCategory` (Category is MBA-
//    /Global-only per AC-131).
// ---------------------------------------------------------------------------

const DisplateTabContent = ({
  listing,
  activeLang,
  onLangChange,
  autoTranslate,
  onAutoTranslateChange,
  activeNicheId,
  textSetters,
  keywordsSetters,
  typeFlagsSetter,
  bgHexSetter,
  advancedOptionsSetter,
  listingReady,
}: DisplateTabContentProps) => {
  const { t } = useTranslation();
  const actions = useGlobalTabActions({
    listing,
    activeLang,
    keywordsSetters,
  });

  const keywordsForLang = listing?.keywords?.[activeLang] ?? [];
  const typeFlags = (listing?.type_flags ?? []) as ListingTypeFlag[];
  const backgroundColorHex = listing?.background_color_hex ?? '';

  const disabledBecauseNoListing = !listingReady;
  const disabledReason = disabledBecauseNoListing
    ? t('publish.edit.displate.noListing', {
        defaultValue:
          'Generate a Displate listing (Convert from MBA) before editing Displate fields.',
      })
    : undefined;

  // ---- Title + Description bindings (language-aware) -------------------
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

  // ---- Handlers --------------------------------------------------------
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
    // `category` echoes the Displate listing's current category (unchanged
    // by design -- AC-131). Still passed through so the batched PATCH
    // remains a single round-trip.
    await advancedOptionsSetter(brand, category);
    actions.closeAdvanced();
  };

  return (
    <Box
      component="section"
      data-testid="DisplateTabContent"
      aria-label={t('publish.edit.displate.sectionLabel', {
        defaultValue: 'Displate listing',
      })}
    >
      {/* Header -- Tagging Options + Advanced Options */}
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
          {t('publish.edit.displate.advanced.trigger', {
            defaultValue: 'Advanced Options',
          })}
        </AdvancedOptionsTriggerButton>
      </HeaderRow>

      {/* Translation tabs -- shared UX */}
      <TranslationTabs
        activeLang={activeLang as MbaListingLanguage}
        onLangChange={(lang) => onLangChange(lang as ListingLanguage)}
        autoTranslate={autoTranslate}
        onAutoTranslateChange={onAutoTranslateChange}
        onTranslateToAll={() => undefined}
      />

      <Stack gap={3}>
        {/* Title + Description */}
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

        {/* Options -- Types + Background Color (Displate-only) */}
        <OptionsWrapper>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TypeColorOptions
                typeFlags={typeFlags}
                colorMode=""
                hideColorMode
                onTypeFlagsChange={typeFlagsSetter}
                onColorModeChange={() => undefined}
                disabled={disabledBecauseNoListing}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <BackgroundColorPicker
                value={backgroundColorHex}
                onChange={bgHexSetter}
                disabled={disabledBecauseNoListing}
                disabledReason={disabledReason}
              />
            </Grid>
          </Grid>
        </OptionsWrapper>
      </Stack>

      {/* Copy EN → all -- confirm */}
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
        hideCategory
        onClose={actions.closeAdvanced}
        onSave={handleAdvancedSave}
      />
    </Box>
  );
};

export default DisplateTabContent;
