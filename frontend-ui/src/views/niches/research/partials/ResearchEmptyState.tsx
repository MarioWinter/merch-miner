import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ScienceIcon from '@mui/icons-material/Science';
import { useTranslation } from 'react-i18next';

const Wrapper = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(8, 3),
  gap: theme.spacing(1),
}));

export const ResearchEmptyState = () => {
  const { t } = useTranslation();

  return (
    <Wrapper>
      <ScienceIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
      <Typography variant="h5" color="text.secondary">
        {t('research.empty.title')}
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {t('research.empty.hint')}
      </Typography>
    </Wrapper>
  );
};
