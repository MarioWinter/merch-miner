import { Button, CircularProgress, Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  email: string;
  inviting: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function InviteRow({ email, inviting, onChange, onSubmit }: Props) {
  const { t } = useTranslation();

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      aria-label={t('settings.workspace.inviteEmail')}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems="flex-start"
        sx={{ mt: 2.5 }}
      >
        <TextField
          value={email}
          onChange={(e) => onChange(e.target.value)}
          label={t('settings.workspace.inviteEmail')}
          type="email"
          size="small"
          fullWidth
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
}
