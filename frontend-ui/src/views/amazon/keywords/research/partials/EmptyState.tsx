import { Box, Typography } from '@mui/material';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  hasQuery: boolean;
}

export const EmptyState = ({ hasQuery }: EmptyStateProps) => {
  const { t } = useTranslation();

  return (
    <Box sx={{ textAlign: 'center', py: 8 }}>
      <SearchOffIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
        {hasQuery ? t('keywords.empty.noResults') : t('keywords.empty.startSearch')}
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {hasQuery ? t('keywords.empty.tryCta') : t('keywords.empty.searchHint')}
      </Typography>
    </Box>
  );
};
