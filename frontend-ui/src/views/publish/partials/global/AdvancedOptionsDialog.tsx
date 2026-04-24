import { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { LISTING_CHAR_LIMITS } from '../../types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdvancedOptionsDialogProps {
  open: boolean;
  defaultBrand: string;
  defaultCategory: string;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (brand: string, category: string) => void | Promise<void>;
}

// ---------------------------------------------------------------------------
// Component — AC-130 / AC-131 / AC-132
// ---------------------------------------------------------------------------

const AdvancedOptionsDialog = ({
  open,
  defaultBrand,
  defaultCategory,
  isSaving = false,
  onClose,
  onSave,
}: AdvancedOptionsDialogProps) => {
  const { t } = useTranslation();
  const [brand, setBrand] = useState(defaultBrand);
  const [category, setCategory] = useState(defaultCategory);

  // Reset inputs every time the dialog opens (mount-on-open pattern).
  useEffect(() => {
    if (open) {
      setBrand(defaultBrand);
      setCategory(defaultCategory);
    }
  }, [open, defaultBrand, defaultCategory]);

  // Mount-on-open: return null when closed so the form state resets cleanly.
  if (!open) return null;

  const handleSave = async () => {
    await onSave(brand.trim(), category.trim());
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="advanced-options-title"
    >
      <DialogTitle id="advanced-options-title">
        {t('publish.edit.global.advanced.title', {
          defaultValue: 'Advanced Options',
        })}
      </DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ mt: 1 }}>
          <TextField
            label={t('publish.edit.global.advanced.brand', {
              defaultValue: 'Brand',
            })}
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            inputProps={{
              maxLength: LISTING_CHAR_LIMITS.brand_name,
              'data-testid': 'AdvancedOptions-brand',
            }}
            fullWidth
            size="small"
            disabled={isSaving}
          />
          <TextField
            label={t('publish.edit.global.advanced.category', {
              defaultValue: 'Category',
            })}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            inputProps={{
              maxLength: 200,
              'data-testid': 'AdvancedOptions-category',
            }}
            fullWidth
            size="small"
            disabled={isSaving}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="text" onClick={onClose} disabled={isSaving}>
          {t('publish.edit.global.advanced.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={isSaving}
          startIcon={isSaving ? <CircularProgress size={16} /> : undefined}
          data-testid="AdvancedOptions-save"
        >
          {t('publish.edit.global.advanced.save', { defaultValue: 'Save' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AdvancedOptionsDialog;
