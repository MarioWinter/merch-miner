// PROJ-34 Phase 13e — Visual Description slot input. Required, multiline.
// Helper text reminds the user of the Architect rule (≥6 concrete details).
//
// Provides BOTH a controlled component (default export) AND a RHF
// `Controller`-wrapped variant (`ControlledVisualDescriptionField`) so callers
// can drop it into a `useForm` setup without re-wiring.

import { TextField } from '@mui/material';
import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface VisualDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  /** Optional override for the placeholder. */
  placeholder?: string;
  disabled?: boolean;
}

const DEFAULT_PLACEHOLDER =
  'a stylized illustration of [SUBJECT] in [PERSPECTIVE], featuring [6+ concrete details: colors, body parts, accessories, pose, line weight]';

const VisualDescriptionField = ({
  value,
  onChange,
  error = false,
  placeholder,
  disabled = false,
}: VisualDescriptionFieldProps) => {
  const { t } = useTranslation();
  return (
    <TextField
      label={t('builder.visualDescription.label', 'Visual Description')}
      required
      fullWidth
      multiline
      minRows={3}
      maxRows={6}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      disabled={disabled}
      placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
      helperText={t(
        'builder.visualDescription.helper',
        'Describe the illustration: subject, perspective, 6+ concrete details',
      )}
      slotProps={{
        inputLabel: { shrink: true },
      }}
      data-testid="visual-description-field"
    />
  );
};

interface ControlledProps<TFieldValues extends FieldValues> {
  control: Control<TFieldValues>;
  name: Path<TFieldValues>;
  placeholder?: string;
  disabled?: boolean;
}

export const ControlledVisualDescriptionField = <
  TFieldValues extends FieldValues,
>({
  control,
  name,
  placeholder,
  disabled,
}: ControlledProps<TFieldValues>) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <VisualDescriptionField
        value={(field.value as string | undefined) ?? ''}
        onChange={field.onChange}
        error={Boolean(fieldState.error)}
        placeholder={placeholder}
        disabled={disabled}
      />
    )}
  />
);

export default VisualDescriptionField;
