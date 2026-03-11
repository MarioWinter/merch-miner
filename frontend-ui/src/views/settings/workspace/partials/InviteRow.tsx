import { Button, CircularProgress, Stack, TextField } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { inviteSchema, type InviteFormValues } from '../schemas/workspaceSchema';

interface Props {
  inviting: boolean;
  onSubmit: (email: string) => void;
}

const InviteRow = ({ inviting, onSubmit }: Props) => {
  const { t } = useTranslation();
  const { control, handleSubmit, reset, formState: { errors } } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '' },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => { onSubmit(data.email); reset(); })}
      aria-label={t('settings.workspace.inviteEmail')}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems="flex-start"
        sx={{ mt: 2.5 }}
      >
        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('settings.workspace.inviteEmail')}
              type="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
            />
          )}
        />
        <Button
          type="submit"
          variant="outlined"
          disabled={inviting}
          sx={{ flexShrink: 0, mt: { xs: 0, sm: '2px' } }}
          startIcon={
            inviting ? <CircularProgress size={14} color="inherit" /> : undefined
          }
        >
          {t('settings.workspace.sendInvite')}
        </Button>
      </Stack>
    </form>
  );
};

export default InviteRow;
