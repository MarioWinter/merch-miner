import { Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ListAltIcon from '@mui/icons-material/ListAlt';
import { useTranslation } from 'react-i18next';

interface EmptyStateProps {
  hasFilters: boolean;
  onNewNiche?: () => void;
  onClearFilters?: () => void;
}

const Root = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  paddingTop: 64,
  paddingBottom: 64,
  gap: 12,
  textAlign: 'center',
});

export const EmptyState = ({ hasFilters, onNewNiche, onClearFilters }: EmptyStateProps) => {
  const { t } = useTranslation();

  if (hasFilters) {
    return (
      <Root aria-label={t('niches.empty.noResults')}>
        <ListAltIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
        <Typography variant="h5" color="text.secondary">
          {t('niches.empty.noResults')}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {t('niches.empty.noResultsHint')}
        </Typography>
        {onClearFilters && (
          <Button variant="text" onClick={onClearFilters} sx={{ mt: 1 }}>
            {t('niches.filter.clearFilters')}
          </Button>
        )}
      </Root>
    );
  }

  return (
    <Root aria-label={t('niches.empty.noNiches')}>
      <ListAltIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="h5" color="text.secondary">
        {t('niches.empty.noNiches')}
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {t('niches.empty.noNichesHint')}
      </Typography>
      {onNewNiche && (
        <Button variant="contained" color="primary" onClick={onNewNiche} sx={{ mt: 1 }}>
          {t('niches.newNiche')}
        </Button>
      )}
    </Root>
  );
};
