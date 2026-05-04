import { useMemo, useState } from 'react';
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
import { skipToken } from '@reduxjs/toolkit/query';
import { COLORS } from '@/style/constants';
import {
  useGetMbaProductCatalogQuery,
  useGetProductConfigQuery,
} from '@/store/publishSlice';
import type { MarketplaceType } from '../../types';

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

interface RoyaltyTextOwnProps {
  tone: 'positive' | 'negative' | 'neutral';
}

const RoyaltyText = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'tone',
})<RoyaltyTextOwnProps>(({ theme, tone }) => ({
  fontVariantNumeric: 'tabular-nums',
  marginTop: theme.spacing(0.25),
  color:
    tone === 'positive'
      ? theme.vars.palette.success.main
      : tone === 'negative'
      ? theme.vars.palette.error.main
      : theme.vars.palette.text.disabled,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const parsePrice = (value: string): number | null => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

const formatRoyalty = (value: number): string => {
  const abs = Math.abs(value).toFixed(2);
  return value < 0 ? `-$${abs}` : `$${abs}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MarketplacePricingProps {
  designId: string | null;
  marketplaceType: MarketplaceType;
  focusedProduct: string | null;
  setPrice: (
    productKey: string,
    marketplace: string,
    price: number,
  ) => void;
  setMarketplaceEnabled: (
    productKey: string,
    marketplace: string,
    enabled: boolean,
  ) => Promise<void> | void;
  royaltyFor: (
    productKey: string,
    marketplace: string,
    price: number | null,
  ) => number | null;
}

const MarketplacePricing = ({
  designId,
  marketplaceType,
  focusedProduct,
  setPrice,
  setMarketplaceEnabled,
  royaltyFor,
}: MarketplacePricingProps) => {
  const { t } = useTranslation();
  const { data: catalog } = useGetMbaProductCatalogQuery();
  const { data: productConfig } = useGetProductConfigQuery(
    designId ? { designId, marketplace_type: marketplaceType } : skipToken,
  );

  // Local buffer per marketplace so the controlled input feels snappy while
  // `setPrice` debounces. Buffer scope is keyed to
  // `(designId, marketplaceType, focusedProduct)`; a scope switch clears
  // the buffer so we don't show stale values under a new context.
  const [priceBuffer, setPriceBuffer] = useState<Record<string, string>>({});
  const [bufferScope, setBufferScope] = useState<string>(
    `${designId ?? 'none'}|${marketplaceType}|${focusedProduct ?? 'none'}`,
  );
  const currentScope = `${designId ?? 'none'}|${marketplaceType}|${focusedProduct ?? 'none'}`;
  if (bufferScope !== currentScope) {
    setBufferScope(currentScope);
    if (Object.keys(priceBuffer).length > 0) setPriceBuffer({});
  }

  const { catalogEntry, configEntry } = useMemo(() => {
    if (!focusedProduct) return { catalogEntry: null, configEntry: null };
    const cat = catalog?.find((c) => c.key === focusedProduct) ?? null;
    const cfg =
      productConfig?.products_config?.find(
        (e) => e.product_type === focusedProduct,
      ) ?? null;
    return { catalogEntry: cat, configEntry: cfg };
  }, [catalog, productConfig?.products_config, focusedProduct]);

  if (!focusedProduct || !catalogEntry) return null;
  if (catalogEntry.marketplaces.length === 0) return null;

  const getDisplayPrice = (mp: string): string => {
    if (mp in priceBuffer) return priceBuffer[mp];
    const fromConfig = configEntry?.marketplaces?.find(
      (m) => m.marketplace === mp,
    )?.price;
    return fromConfig !== undefined && fromConfig !== null
      ? String(fromConfig)
      : '';
  };

  const getEnabled = (mp: string): boolean =>
    configEntry?.marketplaces?.find((m) => m.marketplace === mp)?.enabled ??
    false;

  const handlePriceChange = (mp: string, value: string) => {
    setPriceBuffer((prev) => ({ ...prev, [mp]: value }));
    const n = parsePrice(value);
    if (n !== null) {
      setPrice(focusedProduct, mp, n);
    }
  };

  const handleToggle = (mp: string) => {
    void setMarketplaceEnabled(focusedProduct, mp, !getEnabled(mp));
  };

  return (
    <Stack
      component="section"
      gap={0.5}
      data-testid="MarketplacePricing"
      data-focused-product={focusedProduct}
    >
      <Typography variant="overline" color="text.secondary">
        {t('publish.edit.marketplaces.title', {
          defaultValue: 'Marketplaces & Pricing',
        })}
      </Typography>
      <Grid container spacing={1.25}>
        {catalogEntry.marketplaces.map((mp) => {
          const enabled = getEnabled(mp);
          const display = getDisplayPrice(mp);
          const numericPrice = parsePrice(display);
          const royalty = royaltyFor(focusedProduct, mp, numericPrice);
          const tone: RoyaltyTextOwnProps['tone'] =
            royalty === null
              ? 'neutral'
              : royalty > 0
              ? 'positive'
              : royalty < 0
              ? 'negative'
              : 'neutral';
          return (
            <Grid key={mp} size={{ xs: 6, sm: 4, md: 3 }}>
              <Cell data-testid={`MarketplacePricing-row-${mp}`}>
                <CellHeader
                  control={
                    <CyanCheckbox
                      checked={enabled}
                      onChange={() => handleToggle(mp)}
                      size="small"
                      inputProps={{
                        'aria-label': t('publish.edit.marketplaces.enable', {
                          defaultValue: 'Enable {{code}}',
                          code: mp,
                        }),
                      }}
                    />
                  }
                  label={mp}
                />
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="flex-end"
                >
                  <PriceField
                    value={display}
                    onChange={(e) => handlePriceChange(mp, e.target.value)}
                    type="number"
                    inputMode="decimal"
                    size="small"
                    disabled={!enabled}
                    inputProps={{
                      'aria-label': t('publish.edit.marketplaces.priceFor', {
                        defaultValue: 'Price for {{code}}',
                        code: mp,
                      }),
                      min: 0,
                      step: 0.01,
                    }}
                  />
                </Stack>
                <RoyaltyText
                  variant="caption"
                  tone={tone}
                  data-testid={`MarketplacePricing-royalty-${mp}`}
                  data-royalty-tone={tone}
                >
                  {t('publish.edit.marketplaces.royalty', {
                    defaultValue: 'Royalty',
                  })}
                  : {royalty === null ? '—' : formatRoyalty(royalty)}
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
