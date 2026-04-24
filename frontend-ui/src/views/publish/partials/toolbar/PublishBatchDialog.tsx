import { useState } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  useListTemplatesQuery,
  useBatchUploadJobsMutation,
  useGetMbaProductCatalogQuery,
} from '@/store/publishSlice';
import type { DesignAsset } from '../../types';

interface PublishBatchDialogProps {
  open: boolean;
  onClose: () => void;
  /** Designs selected in the grid — full assets so the pre-flight can
   *  split them into ready (has linked Listing) vs missing (no Listing),
   *  avoiding the silent "1 design skipped" surprise at submit time. */
  selectedDesigns: DesignAsset[];
}

/**
 * Batch-publish the selected designs to MBA by creating one UploadJob per
 * design from a chosen UploadTemplate. Backed by `POST /api/upload-jobs/batch/`.
 * Empty template list → surfaces a CTA pointing to the Edit page template-save
 * flow rather than silently failing (the backend requires a template_id).
 */
const PublishBatchDialog = ({
  open,
  onClose,
  selectedDesigns,
}: PublishBatchDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  // Pre-flight split — ready designs have a linked Listing, missing ones
  // would be silently dropped by the backend (`Design has no linked
  // listing`). Surface the split BEFORE submit so the user can either
  // uncheck them or jump into Edit to create the listing.
  const readyDesigns = selectedDesigns.filter((d) => Boolean(d.listing));
  const missingDesigns = selectedDesigns.filter((d) => !d.listing);
  const selectedDesignIds = readyDesigns.map((d) => d.id);
  const { data: templates = [], isLoading: isLoadingTemplates } =
    useListTemplatesQuery(undefined, { skip: !open });
  const { data: catalog = [] } = useGetMbaProductCatalogQuery(undefined, {
    skip: !open,
  });
  const [batchUploadJobs, { isLoading: isSubmitting }] =
    useBatchUploadJobsMutation();

  // Union of every marketplace the picked template can upload to — drawn
  // from the catalog entry of each `products_config.product_type`. Empty
  // until a template is selected; defaults to `amazon.com` when the
  // catalog is loaded but the intersection is empty (no MBA template).
  const [marketplace, setMarketplace] = useState<string>('amazon.com');

  // Prefer the workspace default if the server marks one; otherwise the
  // first template in the list is a sane "newest saved" default.
  const defaultTemplateId =
    (templates.find((t) => (t as { is_default?: boolean }).is_default)?.id) ??
    templates[0]?.id ??
    '';

  const [templateId, setTemplateId] = useState<string>(defaultTemplateId);
  // Keep local state in sync when the list finishes loading.
  if (!templateId && defaultTemplateId) {
    // Controlled-input pattern: derive during render + guard with equality.
    setTemplateId(defaultTemplateId);
  }

  // Derive available marketplaces from the selected template's
  // products_config — unique-across-products union.
  const pickedTemplate = templates.find((tpl) => tpl.id === templateId);
  const availableMarketplaces = (() => {
    const entries =
      (pickedTemplate as { products_config?: Array<{ marketplaces?: Array<{ marketplace: string }> }> })
        ?.products_config ?? [];
    const set = new Set<string>();
    for (const entry of entries) {
      for (const m of entry.marketplaces ?? []) {
        if (m?.marketplace) set.add(m.marketplace);
      }
    }
    const list = Array.from(set);
    if (list.length > 0) return list;
    // Fallback: every marketplace the catalog supports for any enabled product
    const fallback = new Set<string>();
    for (const entry of catalog) {
      for (const m of entry.marketplaces) fallback.add(m);
    }
    return Array.from(fallback);
  })();

  // Keep `marketplace` state aligned with what the picked template offers —
  // derived-during-render + equality-guarded.
  const [lastMarketplaceSync, setLastMarketplaceSync] = useState<string>('');
  const marketplaceSyncKey = `${templateId}|${availableMarketplaces.join(',')}`;
  if (marketplaceSyncKey && marketplaceSyncKey !== lastMarketplaceSync) {
    setLastMarketplaceSync(marketplaceSyncKey);
    if (availableMarketplaces.length > 0 && !availableMarketplaces.includes(marketplace)) {
      setMarketplace(availableMarketplaces[0]);
    }
  }

  const handleSubmit = async () => {
    if (!templateId || selectedDesignIds.length === 0 || !marketplace) return;
    try {
      const result = await batchUploadJobs({
        design_ids: selectedDesignIds,
        template_id: templateId,
        marketplace,
      }).unwrap();
      // Backend returns `{ created: UploadJob[], errors: [...] }` — but RTK
      // types it as `UploadJob[]`. Be defensive.
      const createdArr = Array.isArray(result)
        ? result
        : ((result as unknown as { created?: unknown[] })?.created ?? []);
      const errorsArr =
        (result as unknown as { errors?: Array<{ error: string }> })?.errors ?? [];
      const createdCount = createdArr.length;
      const errorCount = errorsArr.length;
      if (createdCount > 0) {
        enqueueSnackbar(
          t('publish.toolbar.publishSuccess', {
            defaultValue: '{{count}} upload job(s) queued',
            count: createdCount,
          }),
          { variant: 'success' },
        );
      }
      if (errorCount > 0) {
        // Pre-flight should have caught no-listing cases; this is a
        // defensive fallback for other backend validation errors
        // (e.g. listing missing a title).
        enqueueSnackbar(
          t('publish.toolbar.publishPartial', {
            defaultValue: '{{count}} design(s) skipped — {{reason}}',
            count: errorCount,
            reason: errorsArr[0]?.error ?? 'unknown',
          }),
          { variant: 'warning' },
        );
      }
      if (createdCount === 0 && errorCount === 0) {
        enqueueSnackbar(
          t('publish.toolbar.publishEmpty', {
            defaultValue: 'No upload jobs were created',
          }),
          { variant: 'info' },
        );
      }
      onClose();
    } catch {
      enqueueSnackbar(
        t('publish.toolbar.publishError', {
          defaultValue: 'Failed to queue upload jobs',
        }),
        { variant: 'error' },
      );
    }
  };

  const hasNoTemplates = !isLoadingTemplates && templates.length === 0;
  const canSubmit =
    !isLoadingTemplates &&
    !isSubmitting &&
    templates.length > 0 &&
    readyDesigns.length > 0 &&
    Boolean(templateId) &&
    Boolean(marketplace);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('publish.toolbar.publishDialogTitle', {
          defaultValue: 'Publish {{count}} design(s)',
          count: selectedDesigns.length,
        })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} mt={1}>
          {selectedDesigns.length === 0 && (
            <Alert severity="warning">
              {t('publish.toolbar.publishNoSelection', {
                defaultValue: 'Select at least one design first.',
              })}
            </Alert>
          )}

          {/* Pre-flight breakdown — only render when at least one design is
              selected AND there's something to flag. Silent when 100% ready. */}
          {selectedDesigns.length > 0 && missingDesigns.length > 0 && (
            <Alert
              severity={readyDesigns.length === 0 ? 'error' : 'warning'}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    const ids = missingDesigns.map((d) => d.id).join(',');
                    navigate(`/publish/edit?designs=${ids}`);
                    onClose();
                  }}
                >
                  {t('publish.toolbar.publishEditMissing', {
                    defaultValue: 'Edit {{count}}',
                    count: missingDesigns.length,
                  })}
                </Button>
              }
            >
              {readyDesigns.length === 0
                ? t('publish.toolbar.publishAllMissingListings', {
                    defaultValue:
                      'None of the {{count}} selected design(s) have a listing yet. Open them in Edit to fill in Title + Bullets first.',
                    count: missingDesigns.length,
                  })
                : t('publish.toolbar.publishSomeMissingListings', {
                    defaultValue:
                      '{{ready}} of {{total}} selected design(s) have a listing and will be queued. {{missing}} will be skipped (no linked listing).',
                    ready: readyDesigns.length,
                    total: selectedDesigns.length,
                    missing: missingDesigns.length,
                  })}
            </Alert>
          )}

          {hasNoTemplates && (
            <Alert severity="info">
              {t('publish.toolbar.publishNoTemplates', {
                defaultValue:
                  'No upload templates saved yet. Open a design and click "Save as template" to create one.',
              })}
            </Alert>
          )}
          {templates.length > 0 && (
            <>
              <Typography variant="body2" color="text.secondary">
                {t('publish.toolbar.publishPickTemplate', {
                  defaultValue:
                    'Pick the UploadTemplate to use for every queued job (product types, fit, colors, marketplaces + prices).',
                })}
              </Typography>
              <Select
                value={templateId}
                onChange={(e) => setTemplateId(String(e.target.value))}
                size="small"
                fullWidth
              >
                {templates.map((tpl) => (
                  <MenuItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                    {(tpl as { is_default?: boolean }).is_default
                      ? ` (${t('publish.toolbar.templateDefaultChip', {
                          defaultValue: 'Default',
                        })})`
                      : ''}
                  </MenuItem>
                ))}
              </Select>
              <Typography variant="body2" color="text.secondary">
                {t('publish.toolbar.publishPickMarketplace', {
                  defaultValue:
                    'Target marketplace — one upload job per design for this marketplace. Queue again to publish to additional marketplaces.',
                })}
              </Typography>
              <Select
                value={marketplace}
                onChange={(e) => setMarketplace(String(e.target.value))}
                size="small"
                fullWidth
              >
                {availableMarketplaces.map((mp) => (
                  <MenuItem key={mp} value={mp}>
                    {mp}
                  </MenuItem>
                ))}
              </Select>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!canSubmit}
          onClick={() => void handleSubmit()}
        >
          {isSubmitting
            ? t('publish.toolbar.publishSubmitting', {
                defaultValue: 'Queuing…',
              })
            : t('publish.toolbar.publishSubmit', {
                defaultValue: 'Queue upload jobs',
              })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PublishBatchDialog;
