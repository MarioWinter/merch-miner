import { useCallback } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';
import { MBA_MARKETPLACES } from '../../types';
import type { MarketplaceConfig } from '../../types';
import SectionHeader from './SectionHeader';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Cell = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1),
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: alpha(COLORS.inkElevated, 0.5),
}));

const CellHeader = styled(FormControlLabel)(({ theme }) => ({
  marginLeft: 0,
  marginRight: 0,
  gap: theme.spacing(0.5),
  '& .MuiFormControlLabel-label': {
    ...theme.typography.caption,
    color: theme.vars.palette.text.secondary,
    letterSpacing: '0.02em',
  },
}));

const CyanCheckbox = styled(Checkbox)(({ theme }) => ({
  padding: theme.spacing(0.25),
  color: theme.vars.palette.text.disabled,
  '&.Mui-checked': {
    color: theme.vars.palette.secondary.main,
  },
}));

const PriceField = styled(TextField)(({ theme }) => ({
  width: 96,
  '& .MuiOutlinedInput-root': {
    height: 32,
    backgroundColor: COLORS.inkElevated,
    borderRadius: Number(theme.shape.borderRadius),
  },
  '& .MuiOutlinedInput-input': {
    textAlign: 'right',
    padding: theme.spacing(0.5, 1),
    ...theme.typography.body2,
    fontVariantNumeric: 'tabular-nums',
  },
}));

const RoyaltyText = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.disabled,
  fontVariantNumeric: 'tabular-nums',
  marginTop: theme.spacing(0.25),
}));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarketplacePricingProps {
  configs: MarketplaceConfig[];
  onChange: (configs: MarketplaceConfig[]) => void;
  onOptionsClick: (context: string) => void;
}

const MarketplacePricing = ({
  configs,
  onChange,
  onOptionsClick,
}: MarketplacePricingProps) => {
  const { t } = useTranslation();

  const findConfig = useCallback(
    (code: string) => configs.find((c) => c.marketplace === code),
    [configs],
  );

  const toggleMarketplace = useCallback(
    (code: string) => {
      const existing = findConfig(code);
      if (existing) {
        onChange(
          configs.map((c) =>
            c.marketplace === code ? { ...c, enabled: !c.enabled } : c,
          ),
        );
      } else {
        onChange([
          ...configs,
          { marketplace: code, price: '', enabled: true },
        ]);
      }
    },
    [configs, findConfig, onChange],
  );

  const updatePrice = useCallback(
    (code: string, price: string) => {
      const existing = findConfig(code);
      if (existing) {
        onChange(
          configs.map((c) =>
            c.marketplace === code ? { ...c, price } : c,
          ),
        );
      } else {
        onChange([
          ...configs,
          { marketplace: code, price, enabled: false },
        ]);
      }
    },
    [configs, findConfig, onChange],
  );

  const enabledCount = configs.filter((c) => c.enabled).length;

  return (
    <Stack component="section" gap={0.5}>
      <SectionHeader
        title={t('publish.edit.marketplaces.title')}
        count={enabledCount}
        context="prices"
        onOptionsClick={onOptionsClick}
      />
      <Grid container spacing={1.25}>
        {MBA_MARKETPLACES.map((mp) => {
          const config = findConfig(mp.code);
          const enabled = config?.enabled ?? false;
          const price = config?.price ?? '';
          return (
            <Grid key={mp.code} size={{ xs: 6, sm: 4, md: 3 }}>
              <Cell>
                <CellHeader
                  control={
                    <CyanCheckbox
                      checked={enabled}
                      onChange={() => toggleMarketplace(mp.code)}
                      size="small"
                      inputProps={{
                        'aria-label': t('publish.edit.marketplaces.enable', {
                          code: mp.code,
                        }),
                      }}
                    />
                  }
                  label={mp.code}
                />
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={0.5}
                >
                  <Typography variant="caption" color="text.disabled">
                    {mp.currency}
                  </Typography>
                  <PriceField
                    value={price}
                    onChange={(e) => updatePrice(mp.code, e.target.value)}
                    type="number"
                    inputMode="decimal"
                    size="small"
                    disabled={!enabled}
                    inputProps={{
                      'aria-label': `${mp.code} ${t('publish.edit.marketplaces.price')}`,
                      min: 0,
                      step: 0.01,
                    }}
                  />
                </Stack>
                <RoyaltyText variant="caption">
                  {t('publish.edit.marketplaces.royalty')}: $0.00
                </RoyaltyText>
              </Cell>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
};

export default MarketplacePricing;
