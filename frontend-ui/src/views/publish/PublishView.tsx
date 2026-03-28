import { useState, useCallback } from 'react';
import { Box, Typography, Divider, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useDesignGallery } from './hooks/useDesignGallery';
import { useListingEditor } from './hooks/useListingEditor';
import { useUploadJobs } from './hooks/useUploadJobs';
import { useCommandPalette } from './hooks/useCommandPalette';
import DesignGallerySection from './partials/DesignGallerySection';
import ProductConfigSection from './partials/ProductConfigSection';
import ListingEditorSection from './partials/ListingEditorSection';
import UploadQueueSection from './partials/UploadQueueSection';
import LifecycleChain from './partials/LifecycleChain';
import CommandPalette from './partials/CommandPalette';
import ActionBar from './partials/ActionBar';
import CloudImportDialog from './partials/CloudImportDialog';
import UploadTemplateDropdown from './partials/UploadTemplateDropdown';
import type { DesignAsset, PrintSide, MarketplaceConfig, UploadTemplate } from './types';

const PublishView = () => {
  const { t } = useTranslation();

  // Selected design drives the listing editor context
  const [selectedDesign, setSelectedDesign] = useState<DesignAsset | null>(null);
  const [cloudImportOpen, setCloudImportOpen] = useState(false);

  // Product config state (local — saved via template)
  const [productTypes, setProductTypes] = useState<string[]>(['standard_tshirt']);
  const [fitTypes, setFitTypes] = useState<string[]>(['Adult Unisex']);
  const [printSide, setPrintSide] = useState<PrintSide>('front');
  const [marketplaces, setMarketplaces] = useState<MarketplaceConfig[]>([
    { marketplace: 'amazon_com', price: '19.99', enabled: true },
  ]);

  // Hooks
  const gallery = useDesignGallery();
  const editor = useListingEditor(selectedDesign?.idea ?? null);
  const uploadJobs = useUploadJobs();

  const handleDesignClick = useCallback((design: DesignAsset) => {
    setSelectedDesign(design);
  }, []);

  // PROJ-17 integration: open Chat with field context
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleImprove = useCallback((_fieldName: string, _value: string) => {
    // Placeholder — will integrate when Chat is built
  }, []);

  const handleApplyTemplate = useCallback((template: UploadTemplate) => {
    setProductTypes(template.product_types);
    setFitTypes(template.fit_types);
    setPrintSide(template.print_side);
    setMarketplaces(template.marketplaces);
  }, []);

  const commandPalette = useCommandPalette({
    onCopyListing: editor.handleExport,
    onBulkUpload: () => {
      if (gallery.selectedIds.size > 0) {
        // trigger batch upload flow
      }
    },
  });

  return (
    <Box sx={{ pb: 8 }}>
      {/* Page Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h3">{t('publish.page.title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('publish.page.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <UploadTemplateDropdown
            currentConfig={{
              brand_name: editor.form.getValues('brand_name') ?? '',
              product_types: productTypes,
              fit_types: fitTypes,
              colors: [],
              marketplaces,
              print_side: printSide,
            }}
            onApplyTemplate={handleApplyTemplate}
          />
        </Box>
      </Box>

      <Stack spacing={6} divider={<Divider />}>
        {/* Section 1: Design Gallery */}
        <DesignGallerySection
          gallery={gallery}
          onDesignClick={handleDesignClick}
          onImportCloud={() => setCloudImportOpen(true)}
        />

        {/* Section 2: Product Configuration */}
        <ProductConfigSection
          selectedProductTypes={productTypes}
          onProductTypesChange={setProductTypes}
          selectedFitTypes={fitTypes}
          onFitTypesChange={setFitTypes}
          printSide={printSide}
          onPrintSideChange={setPrintSide}
          marketplaces={marketplaces}
          onMarketplacesChange={setMarketplaces}
        />

        {/* Section 3: Listing Editor */}
        <ListingEditorSection
          editor={editor}
          selectedDesignId={selectedDesign?.id}
          onImprove={handleImprove}
        />

        {/* Section 4: Upload Queue */}
        <UploadQueueSection uploadJobs={uploadJobs} />

        {/* Section 5: Product Lifecycle */}
        <LifecycleChain nicheId={selectedDesign?.niche ?? null} />
      </Stack>

      {/* Overlays */}
      <CommandPalette
        open={commandPalette.open}
        onClose={() => commandPalette.setOpen(false)}
        query={commandPalette.query}
        onQueryChange={commandPalette.setQuery}
        actions={commandPalette.filteredActions}
      />

      <ActionBar
        selectedCount={gallery.selectedIds.size}
        onClear={gallery.clearSelection}
        onBulkUpload={() => {
          // batch upload flow
        }}
        onBulkDelete={gallery.handleBulkDelete}
        isBulkProcessing={gallery.isBulkProcessing}
      />

      <CloudImportDialog
        open={cloudImportOpen}
        onClose={() => setCloudImportOpen(false)}
      />
    </Box>
  );
};

export default PublishView;
