import { FormControl, InputLabel, MenuItem, Select, Typography, type SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MARKETPLACE_OPTIONS } from './constants';
import { FEATURE_KEYS } from '../../constants/featureKeys';
import { useCan } from '../../hooks/useCan';

export type { MarketplaceOption } from './constants';
export { MARKETPLACE_OPTIONS } from './constants';

interface MarketplaceSelectProps {
  value: string;
  onChange: (value: string) => void;
  size?: 'small' | 'medium';
  minWidth?: number;
}

// Only Amazon US is wired into the scraper today. Other marketplaces need
// per-marketplace selectors before they can be enabled. Gate via feature
// flag so we can flip them on globally without redeploying selectors.
const ENABLED_MARKETPLACE_VALUE = 'amazon_com';

const MarketplaceSelect = ({ value, onChange, size = 'small', minWidth = 180 }: MarketplaceSelectProps) => {
  const { t } = useTranslation();
  const multiMarketplaceEnabled = useCan(FEATURE_KEYS.AMAZON_MULTI_MARKETPLACE);

  const handleChange = (e: SelectChangeEvent) => {
    onChange(e.target.value);
  };

  const selected = MARKETPLACE_OPTIONS.find((mp) => mp.value === value);

  return (
    <FormControl size={size} sx={{ minWidth }}>
      <InputLabel>{t('research.marketplace.label')}</InputLabel>
      <Select
        value={value}
        label={t('research.marketplace.label')}
        onChange={handleChange}
        renderValue={() => selected ? `${selected.flag} ${selected.label}` : value}
      >
        {MARKETPLACE_OPTIONS.map((mp) => {
          const isDisabled = !multiMarketplaceEnabled && mp.value !== ENABLED_MARKETPLACE_VALUE;
          return (
            <MenuItem key={mp.value} value={mp.value} disabled={isDisabled}>
              {mp.flag} {mp.label}
              {isDisabled && (
                <Typography
                  component="span"
                  variant="caption"
                  sx={{ ml: 1, opacity: 0.6, fontStyle: 'italic' }}
                >
                  ({t('research.marketplace.comingSoon', 'coming soon')})
                </Typography>
              )}
            </MenuItem>
          );
        })}
      </Select>
    </FormControl>
  );
};

export default MarketplaceSelect;
