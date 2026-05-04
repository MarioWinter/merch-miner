import { useState } from 'react';
import {
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import { useTranslation } from 'react-i18next';
import type { KeywordColumnVisibility } from '../types';
import { saveColumnVisibility } from '../utils/columnStorage';

const COLUMN_KEYS: (keyof KeywordColumnVisibility)[] = [
  'keyword',
  'source',
  'amazon_product_count',
  'monthly_search_volume_exact',
  'ppc_bid_exact',
  'ease_of_ranking_score',
  'organic_product_count',
  'in_product_count',
  'in_slogan_count',
  'monthly_trend',
  'quarterly_trend',
  'monthly_search_volume_broad',
  'ppc_bid_broad',
  'sp_brand_ad_bid',
  'relevancy_score',
  'sponsored_product_count',
  'dominant_category',
  'recommended_promotions',
];

interface ColumnPickerProps {
  visibility: KeywordColumnVisibility;
  onChange: (vis: KeywordColumnVisibility) => void;
}

export const ColumnPicker = ({ visibility, onChange }: ColumnPickerProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleToggle = (key: keyof KeywordColumnVisibility) => {
    // Don't allow hiding 'keyword' column
    if (key === 'keyword') return;
    const next = { ...visibility, [key]: !visibility[key] };
    onChange(next);
    saveColumnVisibility(next);
  };

  return (
    <>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        size="small"
        aria-label={t('keywords.table.columnPicker')}
        sx={{ borderRadius: '8px' }}
      >
        <TuneIcon sx={{ fontSize: 20 }} />
      </IconButton>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Stack sx={{ p: 2, minWidth: 220 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            {t('keywords.table.columnPicker')}
          </Typography>
          {COLUMN_KEYS.map((key) => (
            <FormControlLabel
              key={key}
              control={
                <Checkbox
                  size="small"
                  checked={visibility[key]}
                  onChange={() => handleToggle(key)}
                  disabled={key === 'keyword'}
                />
              }
              label={
                <Typography variant="body2">
                  {t(`keywords.table.col_${key}`)}
                </Typography>
              }
            />
          ))}
          <Button
            size="small"
            onClick={() => setAnchorEl(null)}
            sx={{ mt: 1, alignSelf: 'flex-end' }}
          >
            {t('keywords.table.done')}
          </Button>
        </Stack>
      </Popover>
    </>
  );
};
