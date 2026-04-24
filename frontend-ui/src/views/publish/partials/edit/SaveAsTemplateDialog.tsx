import { useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useCreateTemplateMutation,
  useGetProductConfigQuery,
} from '@/store/publishSlice';
import type { MarketplaceType } from '../../types';

interface SaveAsTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  /** The design whose product_config + listing copy will seed the template. */
  designId: string | null;
  marketplaceType: MarketplaceType;
  /** Pre-fills `brand_name` on the template (taken from the active listing). */
  defaultBrandName?: string;
}

/**
 * Creates a workspace UploadTemplate from the currently focused design's
 * DesignProductConfig + the active Listing's brand_name. Closes the gap
 * between "configure a design once" and "reuse for batch uploads" — the
 * PublishBatchDialog required an existing template before this dialog
 * shipped.
 */
const SaveAsTemplateDialog = ({
  open,
  onClose,
  designId,
  marketplaceType,
  defaultBrandName = '',
}: SaveAsTemplateDialogProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Pull the active product_config so we can seed the template. `skipToken`
  // while the dialog is closed avoids firing a redundant query.
  const { data: productConfig, isLoading: isLoadingConfig } =
    useGetProductConfigQuery(
      designId && open
        ? { designId, marketplace_type: marketplaceType }
        : skipToken,
    );

  const [createTemplate, { isLoading: isSaving }] = useCreateTemplateMutation();
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState(defaultBrandName);
  const [setAsDefault, setSetAsDefault] = useState(false);

  // Sync brand prefill when the dialog re-opens with a different listing.
  const [lastBrand, setLastBrand] = useState(defaultBrandName);
  if (lastBrand !== defaultBrandName) {
    setLastBrand(defaultBrandName);
    setBrandName(defaultBrandName);
  }

  const entries = productConfig?.products_config ?? [];
  const enabledCount = entries.filter((e) => e.enabled).length;

  const canSubmit = name.trim().length > 0 && !isSaving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await createTemplate({
        name: name.trim(),
        brand_name: brandName.trim() || undefined,
        // Copy the full per-product config verbatim — the backend shares
        // the exact `products_config` schema with DesignProductConfig.
        products_config: entries,
        marketplace_type: marketplaceType,
        is_default: setAsDefault,
      }).unwrap();
      enqueueSnackbar(
        t('publish.edit.saveTemplate.success', {
          defaultValue: 'Template saved',
        }),
        { variant: 'success' },
      );
      setName('');
      setSetAsDefault(false);
      onClose();
    } catch {
      enqueueSnackbar(
        t('publish.edit.saveTemplate.error', {
          defaultValue: 'Failed to save template',
        }),
        { variant: 'error' },
      );
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>
        {t('publish.edit.saveTemplate.title', {
          defaultValue: 'Save as Template',
        })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} mt={1}>
          {isLoadingConfig && (
            <Typography variant="body2" color="text.secondary">
              {t('publish.edit.saveTemplate.loading', {
                defaultValue: 'Loading current product config…',
              })}
            </Typography>
          )}
          {!isLoadingConfig && enabledCount === 0 && (
            <Alert severity="warning">
              {t('publish.edit.saveTemplate.noProducts', {
                defaultValue:
                  'Enable at least one product before saving as template — otherwise the template would be empty.',
              })}
            </Alert>
          )}
          {!isLoadingConfig && enabledCount > 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('publish.edit.saveTemplate.summary', {
                defaultValue:
                  'Saves the current {{count}} enabled product(s), fit types, colors, print side, marketplaces, and prices as a reusable {{marketplace}} template.',
                count: enabledCount,
                marketplace: marketplaceType.toUpperCase(),
              })}
            </Typography>
          )}
          <TextField
            label={t('publish.edit.saveTemplate.nameLabel', {
              defaultValue: 'Template name',
            })}
            placeholder={t('publish.edit.saveTemplate.namePlaceholder', {
              defaultValue: 'e.g. Standard Streetwear',
            })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
            required
            autoFocus
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            label={t('publish.edit.saveTemplate.brandLabel', {
              defaultValue: 'Brand name (optional)',
            })}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            size="small"
            fullWidth
            inputProps={{ maxLength: 50 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={setAsDefault}
                onChange={(e) => setSetAsDefault(e.target.checked)}
              />
            }
            label={t('publish.edit.saveTemplate.setDefault', {
              defaultValue:
                'Set as default for {{marketplace}} (auto-applied on Convert)',
              marketplace: marketplaceType.toUpperCase(),
            })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="contained"
          color="secondary"
          disabled={!canSubmit || enabledCount === 0}
          onClick={() => void handleSubmit()}
        >
          {isSaving
            ? t('publish.edit.saveTemplate.saving', { defaultValue: 'Saving…' })
            : t('publish.edit.saveTemplate.save', {
                defaultValue: 'Save template',
              })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SaveAsTemplateDialog;
