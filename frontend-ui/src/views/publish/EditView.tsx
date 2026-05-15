import { useState } from 'react';
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useEditView } from './hooks/useEditView';
import EditPageHeader from './partials/edit/EditPageHeader';
import MarketplaceTabs from './partials/edit/MarketplaceTabs';
import ThumbnailStrip from './partials/edit/ThumbnailStrip';
import ProductTypeScroller from './partials/edit/ProductTypeScroller';
import FitTypePrintSection from './partials/edit/FitTypePrintSection';
import ColorGrid from './partials/edit/ColorGrid';
import MarketplacePricing from './partials/edit/MarketplacePricing';
import MarketplacePlaceholder from './partials/edit/MarketplacePlaceholder';
import ListingFieldsSection from './partials/edit/ListingFieldsSection';
import ListingStateBanner from './partials/edit/ListingStateBanner';
import OptionsSection from './partials/edit/OptionsSection';
import DesignPreview from './partials/edit/DesignPreview';
import GlobalTabContent from './partials/global/GlobalTabContent';
import DisplateTabContent from './partials/global/DisplateTabContent';
import UnsavedChangesBanner from './partials/editor/UnsavedChangesBanner';
import CommandPalette from './partials/command/CommandPalette';
import CopyFromDesignDialog from './partials/edit/CopyFromDesignDialog';
import ExportPreflightDialog from './partials/export/ExportPreflightDialog';
import EmptyState from './partials/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const ViewRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
});

const TabsBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(1.5, 3),
  borderBottom: `1px solid ${theme.vars.palette.divider}`,
}));

const Layout = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '200px 1fr 300px',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    // PROJ-30 T3.18 — Big-Bang single-column stack: thumbnail strip
    // (horizontal-scrolling at this width) auto-sized at top, then the
    // center editor fills the remaining height, then the right preview
    // collapses into its own auto-sized row below.
    gridTemplateColumns: '1fr',
    gridTemplateRows: 'auto 1fr auto',
    overflow: 'auto',
  },
}));

// PROJ-30 T3.18 — On <md, cap the horizontal thumbnail strip at ~120px so
// the rest of the viewport stays usable.
const ThumbnailRow = styled(Box)(({ theme }) => ({
  minHeight: 0,
  [theme.breakpoints.down('md')]: {
    maxHeight: 120,
    overflow: 'hidden',
  },
}));

const CenterColumn = styled(Box)(({ theme }) => ({
  overflowY: 'auto',
  padding: theme.spacing(3),
  minHeight: 0,
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2),
  },
}));

const RightColumn = styled(Box)(({ theme }) => ({
  borderLeft: `1px solid ${theme.vars.palette.divider}`,
  padding: theme.spacing(3),
  position: 'sticky',
  top: 0,
  alignSelf: 'start',
  maxHeight: '100%',
  overflowY: 'auto',
  [theme.breakpoints.down('md')]: {
    borderLeft: 'none',
    borderTop: `1px solid ${theme.vars.palette.divider}`,
    position: 'static',
    padding: theme.spacing(2),
  },
}));

// PROJ-30 T3.18 — Mobile-only header row above the right preview Collapse
// section. Lets users hide the preview to focus on form editing.
const MobilePreviewToggle = styled(Box)(({ theme }) => ({
  display: 'none',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 2),
  borderTop: `1px solid ${theme.vars.palette.divider}`,
  [theme.breakpoints.down('md')]: {
    display: 'flex',
  },
}));

const EmptyWrap = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EditView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isDesktop } = useResponsiveLayout();
  // PROJ-30 T3.18 — Mobile-only collapsible right preview. Defaults
  // collapsed on phone so the editor form is the first thing users see.
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const {
    designIds,
    designs,
    activeDesign,
    activeIndex,
    setActiveIndex,
    isLoading,
    handleDesignIdsChange,
    activeMarketplace,
    setActiveMarketplace,
    // Phase P1/P2 — per-product control via editFormState.
    editFormState,
    listingForm,
    activeLang,
    setActiveLang,
    autoTranslate,
    setAutoTranslate,
    isDirty,
    handleDiscardListing,
    handleSaveListing,
    handleRetryListing,
    // Phase O3/Round-4: 5-state banner inputs (saving / failed / offline / queue)
    isEditSaving,
    editSaveError,
    isEditOnline,
    editQueueLength,
    // D7 listing state
    listing,
    isLoadingListing,
    isFetchingListing,
    listingError,
    listingNotFound,
    cmdPalette,
    // D7 copy-from-design
    copyDialog,
    isApplyingCopy,
    closeCopyDialog,
    applyCopy,
    // G3 convert conflict dialog
    pendingConvert,
    isConverting,
    confirmConvertOverwrite,
    cancelConvertOverwrite,
    // W4 export dialog state
    exportRequest,
    closeExportDialog,
  } = useEditView();

  // Phase P7 — last `truncated_fields` payload from the AI-Improve
  // mutation. Drives the per-field "AI truncated" chip inside
  // ListingFieldsSection. Cleared when the user runs AI-Improve again.
  const [truncatedFields, setTruncatedFields] = useState<string[]>([]);

  // Empty state — no ids in URL
  if (designIds.length === 0) {
    return (
      <ViewRoot>
        <EmptyWrap>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" color="text.secondary" gutterBottom>
              {t('publish.edit.empty.title')}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
              {t('publish.edit.empty.hint')}
            </Typography>
            <EmptyState
              onUpload={() => navigate('/publish')}
              onImport={() => navigate('/publish')}
            />
          </Box>
        </EmptyWrap>
      </ViewRoot>
    );
  }

  const isMba = activeMarketplace === 'mba';
  const isGlobal = activeMarketplace === 'global';
  const isDisplate = activeMarketplace === 'displate';
  const globalListing = isGlobal ? listing : null;
  const displateListing = isDisplate ? listing : null;

  return (
    <ViewRoot>
      <EditPageHeader
        designIds={designIds}
        onDesignIdsChange={handleDesignIdsChange}
        aiImprove={editFormState.aiImprove}
        isImproving={editFormState.isImproving}
        hasListing={Boolean(listing)}
        onTruncated={setTruncatedFields}
        isDirty={isDirty}
        isSaving={isEditSaving}
        saveError={editSaveError}
        onSave={handleSaveListing}
        activeDesignId={activeDesign?.id ?? null}
        activeMarketplace={activeMarketplace}
        defaultBrandName={listing?.brand_name ?? ''}
      />

      <UnsavedChangesBanner
        isDirty={isDirty}
        isSaving={isEditSaving}
        saveError={editSaveError}
        onSave={handleSaveListing}
        onDiscard={handleDiscardListing}
        online={isEditOnline}
        queueLength={editQueueLength}
      />

      <TabsBar>
        <MarketplaceTabs value={activeMarketplace} onChange={setActiveMarketplace} />
      </TabsBar>

      <Layout>
        <ThumbnailRow>
          <ThumbnailStrip
            designIds={designIds}
            designs={designs}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            isLoading={isLoading}
          />
        </ThumbnailRow>

        <CenterColumn>
          {isMba ? (
            <Stack gap={3}>
              <ProductTypeScroller
                designId={activeDesign?.id ?? null}
                marketplaceType={activeMarketplace as 'global' | 'mba' | 'displate'}
                focusedProduct={editFormState.focusedProduct}
                onFocusedProductChange={editFormState.setFocusedProduct}
                toggleProductEnabled={
                  editFormState.controlSetters.toggleProductEnabled
                }
              />
              <FitTypePrintSection
                designId={activeDesign?.id ?? null}
                marketplaceType={activeMarketplace as 'global' | 'mba' | 'displate'}
                focusedProduct={editFormState.focusedProduct}
                setFitTypes={editFormState.controlSetters.setFitTypes}
                setPrintSide={editFormState.controlSetters.setPrintSide}
              />
              <ColorGrid
                designId={activeDesign?.id ?? null}
                marketplaceType={activeMarketplace as 'global' | 'mba' | 'displate'}
                focusedProduct={editFormState.focusedProduct}
                toggleColor={editFormState.controlSetters.toggleColor}
              />
              <MarketplacePricing
                designId={activeDesign?.id ?? null}
                marketplaceType={activeMarketplace as 'global' | 'mba' | 'displate'}
                focusedProduct={editFormState.focusedProduct}
                setPrice={editFormState.priceSetters.setPrice}
                setMarketplaceEnabled={
                  editFormState.controlSetters.setMarketplaceEnabled
                }
                royaltyFor={editFormState.royaltyFor}
              />
              <ListingStateBanner
                isLoading={isLoadingListing}
                isFetching={isFetchingListing}
                notFound={listingNotFound}
                hasError={Boolean(listingError)}
                onRetry={handleRetryListing}
                marketplace={activeMarketplace}
              />
              {/* G1: hide editable form during initial load + 404 + hard error.
                  Banner owns the skeleton/empty/error UI for those states.
                  Round-4: AI Improve + Save moved into EditPageHeader per
                  AC-70 + AC-74. */}
              {!isLoadingListing && !listingNotFound && !listingError && (
                <>
                  <ListingFieldsSection
                    listing={listing}
                    textSetters={editFormState.textSetters}
                    activeLang={activeLang}
                    onLangChange={setActiveLang}
                    autoTranslate={autoTranslate}
                    onAutoTranslateChange={setAutoTranslate}
                    truncatedFields={truncatedFields}
                  />
                  <OptionsSection control={listingForm.control} />
                </>
              )}
            </Stack>
          ) : isGlobal ? (
            <Stack gap={3}>
              <ListingStateBanner
                isLoading={isLoadingListing}
                isFetching={isFetchingListing}
                notFound={listingNotFound}
                hasError={Boolean(listingError)}
                onRetry={handleRetryListing}
                marketplace={activeMarketplace}
              />
              {!isLoadingListing && !listingError && (
                <GlobalTabContent
                  listing={globalListing}
                  activeLang={activeLang}
                  onLangChange={setActiveLang}
                  autoTranslate={autoTranslate}
                  onAutoTranslateChange={setAutoTranslate}
                  activeNicheId={activeDesign?.niche ?? null}
                  textSetters={editFormState.textSetters}
                  keywordsSetters={editFormState.keywordsSetters}
                  typeFlagsSetter={editFormState.typeFlagsSetter}
                  colorModeSetter={editFormState.colorModeSetter}
                  advancedOptionsSetter={editFormState.advancedOptionsSetter}
                  listingReady={Boolean(globalListing)}
                />
              )}
            </Stack>
          ) : isDisplate ? (
            <Stack gap={3}>
              <ListingStateBanner
                isLoading={isLoadingListing}
                isFetching={isFetchingListing}
                notFound={listingNotFound}
                hasError={Boolean(listingError)}
                onRetry={handleRetryListing}
                marketplace={activeMarketplace}
              />
              {!isLoadingListing && !listingError && (
                <DisplateTabContent
                  listing={displateListing}
                  activeLang={activeLang}
                  onLangChange={setActiveLang}
                  autoTranslate={autoTranslate}
                  onAutoTranslateChange={setAutoTranslate}
                  activeNicheId={activeDesign?.niche ?? null}
                  textSetters={editFormState.textSetters}
                  keywordsSetters={editFormState.keywordsSetters}
                  typeFlagsSetter={editFormState.typeFlagsSetter}
                  bgHexSetter={editFormState.bgHexSetter}
                  advancedOptionsSetter={editFormState.advancedOptionsSetter}
                  listingReady={Boolean(displateListing)}
                />
              )}
            </Stack>
          ) : (
            <MarketplacePlaceholder marketplace={activeMarketplace} />
          )}
        </CenterColumn>

        {isDesktop ? (
          <RightColumn>
            <DesignPreview design={activeDesign} />
          </RightColumn>
        ) : (
          <Box>
            <MobilePreviewToggle>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                {t('publish.edit.previewTitle', { defaultValue: 'Preview' })}
              </Typography>
              <Button
                size="small"
                onClick={() => setMobilePreviewOpen((v) => !v)}
                endIcon={mobilePreviewOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                aria-expanded={mobilePreviewOpen}
                aria-controls="edit-view-mobile-preview"
              >
                {mobilePreviewOpen
                  ? t('publish.edit.hidePreview', { defaultValue: 'Hide preview' })
                  : t('publish.edit.showPreview', { defaultValue: 'Show preview' })}
              </Button>
            </MobilePreviewToggle>
            <Collapse in={mobilePreviewOpen} unmountOnExit id="edit-view-mobile-preview">
              <RightColumn>
                <DesignPreview design={activeDesign} />
              </RightColumn>
            </Collapse>
          </Box>
        )}
      </Layout>

      {/* D7: Copy-from-Design Dialog */}
      <CopyFromDesignDialog
        open={copyDialog.open}
        scope={copyDialog.scope}
        designs={designs}
        activeDesignId={activeDesign?.id ?? null}
        isApplying={isApplyingCopy}
        onClose={closeCopyDialog}
        onConfirm={applyCopy}
      />

      {/* G3: Convert overwrite confirmation */}
      <ConfirmDialog
        open={Boolean(pendingConvert)}
        title={t('publish.convert.confirmTitle', {
          defaultValue: 'Overwrite existing {{target}} listing?',
          target: activeMarketplace.toUpperCase(),
        })}
        body={t('publish.convert.confirmBody', {
          defaultValue:
            'A {{target}} listing already exists for this design. Converting from {{source}} will replace its content. This cannot be undone.',
          target: activeMarketplace.toUpperCase(),
          source: pendingConvert?.sourceMarketplace.toUpperCase() ?? '',
        })}
        confirmLabel={t('publish.convert.confirmButton', {
          defaultValue: 'Overwrite',
        })}
        cancelLabel={t('publish.convert.cancelButton', {
          defaultValue: 'Cancel',
        })}
        confirmColor="warning"
        showDeleteIcon={false}
        isLoading={isConverting}
        onConfirm={() => {
          void confirmConvertOverwrite();
        }}
        onCancel={cancelConvertOverwrite}
      />

      {/* Command Palette Overlay */}
      <CommandPalette
        open={cmdPalette.open}
        query={cmdPalette.query}
        onQueryChange={cmdPalette.setQuery}
        context={cmdPalette.context}
        activeIndex={cmdPalette.activeIndex}
        matched={cmdPalette.matched}
        recentActions={cmdPalette.recentActions}
        flatActions={cmdPalette.flatActions}
        onKeyDown={cmdPalette.handleKeyDown}
        onExecute={cmdPalette.executeAction}
        onClose={cmdPalette.closePalette}
      />

      {/* Phase W4 — Export preflight dialog. `currentDesignId` lets the
          dialog suppress the "Edit 1" quick-fix when the only skipped row
          is the design we are already editing (EC-81). */}
      {exportRequest && (
        <ExportPreflightDialog
          open
          template={exportRequest.template}
          format={exportRequest.format}
          designIds={designIds}
          currentDesignId={activeDesign?.id ?? null}
          onClose={closeExportDialog}
        />
      )}
    </ViewRoot>
  );
};

export default EditView;
