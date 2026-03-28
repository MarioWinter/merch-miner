import { Box, Button, Typography } from '@mui/material';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  onCreateClick?: () => void;
}

export const EmptyState = ({ onCreateClick }: EmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 8,
      }}
    >
      <LightbulbOutlinedIcon
        sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }}
      />
      <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
        {t('ideas.empty.title')}
      </Typography>
      <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
        {t('ideas.empty.hint')}
      </Typography>
      {onCreateClick && (
        <Button variant="contained" onClick={onCreateClick}>
          {t('ideas.empty.cta')}
        </Button>
      )}
    </Box>
  );
};
