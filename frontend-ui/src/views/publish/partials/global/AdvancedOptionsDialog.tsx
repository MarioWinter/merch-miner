import { useState } from 'react';
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
//
// Mount-on-open: parent gates render via `open` and a `key={id}` further up
// the tree, so local state ALWAYS initializes from the seed on each open
// cycle. This avoids the setState-in-effect anti-pattern.
// ---------------------------------------------------------------------------

const AdvancedOptionsDialogInner = ({
  defaultBrand,
  defaultCategory,
  isSaving = false,
  onClose,
  onSave,
}: Omit<AdvancedOptionsDialogProps, 'open'>) => {
  const { t } = useTranslation();
  const [brand, setBrand] = useState(defaultBrand);
  const [category, setCategory] = useState(defaultCategory);

  const handleSave = async () => {
    await onSave(brand.trim(), category.trim());
  };

  return (
    <Dialog
      open
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

// Mount-on-open wrapper: unmount + remount resets the inner `useState` seed.
const AdvancedOptionsDialog = ({ open, ...rest }: AdvancedOptionsDialogProps) => {
  if (!open) return null;
  return <AdvancedOptionsDialogInner {...rest} />;
};

export default AdvancedOptionsDialog;
