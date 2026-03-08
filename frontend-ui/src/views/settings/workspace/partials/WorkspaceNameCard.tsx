import { Button, Stack, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SettingsCard, SectionTitle } from '../../../../components/SettingsCard';

interface Props {
  nameValue: string;
  isAdmin: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
}

const WorkspaceNameCard = ({ nameValue, isAdmin, onChange, onSave }: Props) => {
  const { t } = useTranslation();

  return (
    <SettingsCard>
      <form
        onSubmit={(e) => { e.preventDefault(); onSave(); }}
        aria-label={t('settings.workspace.title')}
      >
        <SectionTitle>{t('settings.workspace.title')}</SectionTitle>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
          <TextField
            value={nameValue}
            onChange={(e) => onChange(e.target.value)}
            label={t('settings.workspace.nameLabel')}
            disabled={!isAdmin}
            fullWidth
            helperText={!isAdmin ? t('settings.workspace.nameAdminOnly') : undefined}
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
