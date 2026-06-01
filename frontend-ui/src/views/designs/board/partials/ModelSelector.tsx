import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { DesignModel } from '../types';

// Order mirrors `GenerationZone.tsx::MODELS` — newest release first.
const MODEL_LABELS: Record<DesignModel, string> = {
  'openai/gpt-5.4-image-2': 'GPT-5.4 Image 2',
  'google/gemini-3.1-flash-preview-image-generation': 'Nano Banana 2 (Gemini 3.1 Flash)',
  'black-forest-labs/flux.2-klein-4b': 'FLUX.2 Klein 4B',
  'black-forest-labs/flux.2-max': 'FLUX.2 Max',
  'google/gemini-3-pro-preview-image-generation': 'Nano Banana Pro (Gemini 3 Pro)',
  'black-forest-labs/flux.2-flex': 'FLUX.2 Flex',
  'black-forest-labs/flux.2-pro': 'FLUX.2 Pro',
  'openai/gpt-5-image': 'GPT-5 Image',
  'openai/gpt-5-image-mini': 'GPT-5 Image Mini',
  'google/gemini-2.5-flash-preview-image-generation': 'Nano Banana (Gemini 2.5 Flash)',
};

const MODELS: DesignModel[] = [
  'openai/gpt-5.4-image-2',
  'google/gemini-3.1-flash-preview-image-generation',
  'black-forest-labs/flux.2-klein-4b',
  'black-forest-labs/flux.2-max',
  'google/gemini-3-pro-preview-image-generation',
  'black-forest-labs/flux.2-flex',
  'black-forest-labs/flux.2-pro',
  'openai/gpt-5-image',
  'openai/gpt-5-image-mini',
  'google/gemini-2.5-flash-preview-image-generation',
];

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
            {MODEL_LABELS[model]}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
