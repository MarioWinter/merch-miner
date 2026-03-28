import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DesignModel } from '../types';

const MODELS: DesignModel[] = ['gemini_flash', 'gemini_pro', 'gpt_image', 'flux'];

interface ModelSelectorProps {
  value: DesignModel;
  onChange: (model: DesignModel) => void;
  disabled?: boolean;
}

export const ModelSelector = ({ value, onChange, disabled }: ModelSelectorProps) => {
  const { t } = useTranslation();

  const handleChange = (e: SelectChangeEvent) => {
    onChange(e.target.value as DesignModel);
  };

  return (
    <FormControl size="small" fullWidth disabled={disabled}>
      <InputLabel id="model-select-label">
        {t('design.model.label')}
      </InputLabel>
      <Select
        labelId="model-select-label"
        value={value}
        onChange={handleChange}
        label={t('design.model.label')}
        aria-label={t('design.model.label')}
      >
        {MODELS.map((model) => (
          <MenuItem key={model} value={model}>
            {t(`design.model.${model}`)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
