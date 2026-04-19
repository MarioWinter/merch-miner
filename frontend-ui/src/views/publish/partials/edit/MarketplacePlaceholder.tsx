import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { MarketplaceTab } from './MarketplaceTabs';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const PlaceholderRoot = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  border: `1px dashed ${theme.vars.palette.divider}`,
  color: theme.vars.palette.text.disabled,
  textAlign: 'center',
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarketplacePlaceholderProps {
  marketplace: MarketplaceTab;
}

const MarketplacePlaceholder = ({ marketplace }: MarketplacePlaceholderProps) => {
  const { t } = useTranslation();
  const label = t(`publish.edit.marketplace.${marketplace}`);

  return (
    <PlaceholderRoot role="status">
      <Typography variant="body2">
        {t('publish.edit.placeholder.comingSoon', { marketplace: label })}
      </Typography>
    </PlaceholderRoot>
  );
};

export default MarketplacePlaceholder;
