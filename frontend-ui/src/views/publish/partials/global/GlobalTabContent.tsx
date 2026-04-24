import { Box, Stack } from '@mui/material';
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
import type { UseEditFormStateReturn } from '../../hooks/useEditFormState';
import { useGlobalTabActions } from '../../hooks/useGlobalTabActions';
import KeywordsChipField from './KeywordsChipField';
import KeywordResearchLinks from './KeywordResearchLinks';
import TypeColorOptions from './TypeColorOptions';
import TaggingOptionsMenu from './TaggingOptionsMenu';
import ImportKeywordsCsvDialog from './ImportKeywordsCsvDialog';
import AdvancedOptionsDialog from './AdvancedOptionsDialog';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: theme.spacing(1),
}));

// Per AC-88, Global Options section sits below the listing fields -- this
// provides a shallow visual container for the Types + Color group.
const OptionsWrapper = styled(Box)(({ theme }) => ({
  paddingTop: theme.spacing(2),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
}));

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

// Reuse the same "bind" shape that ListingFieldsSection builds so the parent
// can feed one consistent source of truth. `colorOptions` is reserved for
// future use (Global may eventually support a palette); today it maps 1:1
// with ListingColorMode so we leave it unused but typed for V-tab parity.
export interface GlobalTabContentProps {
  listing: Listing | null;
  activeLang: ListingLanguage;
  /** Inherited niche UUID for the design -- drives KW Finder deeplink. */
  activeNicheId: string | null;
  keywordsSetters: UseEditFormStateReturn['keywordsSetters'];
  typeFlagsSetter: UseEditFormStateReturn['typeFlagsSetter'];
  colorModeSetter: UseEditFormStateReturn['colorModeSetter'];
  advancedOptionsSetter: UseEditFormStateReturn['advancedOptionsSetter'];
  /** Disable every mutating control when no listing exists yet (lazy-create
   *  TBD per AC-108 -- currently the Listing must be generated via AI
   *  Improve or Convert before Global fields become editable). */
  listingReady: boolean;
  /** Reserved for a future Global-level palette picker. */
  colorOptions?: MbaColor[];
}

// ---------------------------------------------------------------------------
// Component — Phase U8 composition
// ---------------------------------------------------------------------------

const GlobalTabContent = ({
  listing,
  activeLang,
  activeNicheId,
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
          'Generate a listing (AI Improve or Convert) before editing Global fields.',
      })
    : undefined;

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
    <Box data-testid="GlobalTabContent">
      <SectionHeader>
        <TaggingOptionsMenu
          disabled={disabledBecauseNoListing}
          onCopyEnToAll={handleTagging.copyEn}
          onClearAll={handleTagging.clearAll}
          onImportCsv={handleTagging.importCsv}
        />
        <Box>
          {/* AC-130 -- Advanced Options text link next to Tagging Options. */}
          <TaggingOptionsMenuDivider />
        </Box>
        <AdvancedOptionsTrigger
          disabled={disabledBecauseNoListing}
          onClick={actions.openAdvanced}
        />
      </SectionHeader>

      <Stack gap={3} sx={{ mt: 2 }}>
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

// ---------------------------------------------------------------------------
// Sub-components (kept colocated — small, single-use)
// ---------------------------------------------------------------------------

const TaggingOptionsMenuDivider = styled('span')(({ theme }) => ({
  width: 1,
  height: theme.spacing(2.5),
  backgroundColor: theme.vars.palette.divider,
  display: 'inline-block',
}));

interface AdvancedOptionsTriggerProps {
  disabled: boolean;
  onClick: () => void;
}

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

const AdvancedOptionsTrigger = ({
  disabled,
  onClick,
}: AdvancedOptionsTriggerProps) => {
  const { t } = useTranslation();
  return (
    <AdvancedOptionsTriggerButton
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid="AdvancedOptionsTrigger"
    >
      {t('publish.edit.global.advanced.trigger', {
        defaultValue: 'Advanced Options',
      })}
    </AdvancedOptionsTriggerButton>
  );
};
