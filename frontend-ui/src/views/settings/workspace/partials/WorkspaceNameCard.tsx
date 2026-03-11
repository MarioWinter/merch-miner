import { useEffect } from 'react';
import { Button, Stack, TextField } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { SettingsCard, SectionTitle } from '../../../../components/SettingsCard';
import {
  workspaceNameSchema,
  type WorkspaceNameFormValues,
} from '../schemas/workspaceSchema';

interface Props {
  defaultName: string;
  isAdmin: boolean;
  onSave: (name: string) => void;
}

const WorkspaceNameCard = ({ defaultName, isAdmin, onSave }: Props) => {
  const { t } = useTranslation();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<WorkspaceNameFormValues>({
    resolver: zodResolver(workspaceNameSchema),
    defaultValues: { name: defaultName },
  });

  useEffect(() => {
    reset({ name: defaultName });
  }, [defaultName, reset]);

  return (
    <SettingsCard>
      <form
        onSubmit={handleSubmit((data) => onSave(data.name))}
        aria-label={t('settings.workspace.title')}
      >
        <SectionTitle>{t('settings.workspace.title')}</SectionTitle>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          <Controller
            name="name"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label={t('settings.workspace.nameLabel')}
                disabled={!isAdmin}
                fullWidth
                error={!!errors.name}
                helperText={
                  errors.name?.message ??
                  (!isAdmin ? t('settings.workspace.nameAdminOnly') : undefined)
                }
              />
            )}
          />
          {isAdmin && (
            <Button
              type="submit"
              variant="contained"
              sx={{ mt: { xs: 0, sm: '2px' }, flexShrink: 0 }}
            >
              {t('settings.workspace.save')}
            </Button>
          )}
        </Stack>
      </form>
    </SettingsCard>
  );
};

export default WorkspaceNameCard;
