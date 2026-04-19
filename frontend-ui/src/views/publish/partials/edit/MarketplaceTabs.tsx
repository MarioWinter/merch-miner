import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

export type MarketplaceTab = 'global' | 'mba' | 'displate';

interface MarketplaceTabsProps {
  value: MarketplaceTab;
  onChange: (value: MarketplaceTab) => void;
}

const StyledToggleButton = styled(ToggleButton)(({ theme }) => ({
  height: theme.spacing(5),
  minWidth: theme.spacing(11),
  textTransform: 'none',
  fontSize: '0.8125rem',
  fontWeight: 500,
  border: `1px solid ${theme.vars.palette.divider}`,
  color: theme.vars.palette.text.secondary,
  '&.Mui-selected': {
    backgroundColor: alpha(COLORS.red, 0.12),
    color: COLORS.red,
    borderColor: alpha(COLORS.red, 0.35),
    '&:hover': {
      backgroundColor: alpha(COLORS.red, 0.18),
    },
  },
}));

const MarketplaceTabs = ({ value, onChange }: MarketplaceTabsProps) => {
  const { t } = useTranslation();

  const handleChange = (_e: React.MouseEvent<HTMLElement>, next: MarketplaceTab | null) => {
    if (next) onChange(next);
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      aria-label="Marketplace"
      size="small"
    >
      <StyledToggleButton value="global">
        {t('publish.edit.marketplace.global')}
      </StyledToggleButton>
      <StyledToggleButton value="mba">
        {t('publish.edit.marketplace.mba')}
      </StyledToggleButton>
      <StyledToggleButton value="displate">
        {t('publish.edit.marketplace.displate')}
      </StyledToggleButton>
    </ToggleButtonGroup>
  );
};

export default MarketplaceTabs;
