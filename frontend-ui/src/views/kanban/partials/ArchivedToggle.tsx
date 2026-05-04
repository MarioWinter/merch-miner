import { FormControlLabel, Switch, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ArchivedToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ArchivedToggle = ({ checked, onChange }: ArchivedToggleProps) => {
  const { t } = useTranslation();
  return (
    <FormControlLabel
      control={
        <Switch
          size="small"
          checked={checked}
          onChange={(_, v) => onChange(v)}
        />
      }
      label={
        <Typography variant="body2" color="text.secondary">
          {t('kanban.filter.showArchived')}
        </Typography>
      }
    />
  );
};

export default ArchivedToggle;
