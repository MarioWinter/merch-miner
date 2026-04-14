import { FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MARKETPLACE_OPTIONS } from './constants';

export type { MarketplaceOption } from './constants';
export { MARKETPLACE_OPTIONS } from './constants';

interface MarketplaceSelectProps {
  value: string;
  onChange: (value: string) => void;
  size?: 'small' | 'medium';
  minWidth?: number;
}

const MarketplaceSelect = ({ value, onChange, size = 'small', minWidth = 180 }: MarketplaceSelectProps) => {
  const { t } = useTranslation();

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
        {MARKETPLACE_OPTIONS.map((mp) => (
          <MenuItem key={mp.value} value={mp.value}>
            {mp.flag} {mp.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default MarketplaceSelect;
