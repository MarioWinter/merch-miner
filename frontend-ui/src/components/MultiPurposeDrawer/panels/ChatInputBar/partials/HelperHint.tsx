import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const HelperHint = () => {
  const { t } = useTranslation();
  return (
    <Typography
      variant="caption"
      color="text.secondary"
      data-testid="chat-input-helper-hint"
      sx={{ display: 'block', mt: 1, px: 1 }}
    >
      {t('search.chatBar.helper')}
    </Typography>
  );
};

export default HelperHint;
