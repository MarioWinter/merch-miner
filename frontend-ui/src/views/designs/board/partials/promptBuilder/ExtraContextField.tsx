// PROJ-34 Phase 13e — Extra Context slot input (free-text, optional).
// Multiline TextField rendered inside the "Niche & Extra" accordion (Phase
// 13g). Content is appended verbatim before the tech specs by the backend
// renderer in `build_form_prompt`.

import { TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ExtraContextFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const DEFAULT_PLACEHOLDER =
  'Optional custom additions appended verbatim before the tech specs';

const ExtraContextField = ({
  value,
  onChange,
  disabled = false,
}: ExtraContextFieldProps) => {
  const { t } = useTranslation();
  return (
    <TextField
      label={t('builder.extraContext.label', 'Extra Context')}
      fullWidth
      multiline
      minRows={2}
      maxRows={4}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      placeholder={t('builder.extraContext.placeholder', DEFAULT_PLACEHOLDER)}
      slotProps={{
        inputLabel: { shrink: true },
      }}
      data-testid="extra-context-field"
    />
  );
};

export default ExtraContextField;
