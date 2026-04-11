import { Stack, TextField } from '@mui/material';
import { Controller, type UseFormReturn, type SubmitHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { CreateNicheFormValues } from '../schemas/nicheSchema';

interface PipelineCreateFormProps {
  form: UseFormReturn<CreateNicheFormValues>;
  onSubmit: SubmitHandler<CreateNicheFormValues>;
}

export const PipelineCreateForm = ({ form, onSubmit }: PipelineCreateFormProps) => {
  const { t } = useTranslation();

  return (
    <Stack component="form" id="niche-create-form" onSubmit={form.handleSubmit(onSubmit)} gap={2.5}>
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={t('niches.drawer.name')}
            placeholder={t('niches.drawer.namePlaceholder')}
            error={!!fieldState.error}
            helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            required
            fullWidth
            size="small"
            autoFocus
          />
        )}
      />
      <Controller
        name="notes"
        control={form.control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label={t('niches.drawer.notes')}
            placeholder={t('niches.drawer.notesPlaceholder')}
            error={!!fieldState.error}
            helperText={fieldState.error ? t(fieldState.error.message ?? '') : undefined}
            multiline
            rows={4}
            fullWidth
            size="small"
          />
        )}
      />
    </Stack>
  );
};
