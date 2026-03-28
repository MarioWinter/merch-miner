import { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { MBA_PRODUCT_TYPES, MBA_FIT_TYPES, MBA_MARKETPLACES } from '../types';
import type { MarketplaceConfig, PrintSide } from '../types';

const ProductTypeCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected: boolean }>(({ theme, $selected }) => ({
  padding: theme.spacing(1.5),
  borderRadius: 8,
  border: '1px solid',
  borderColor: $selected
    ? theme.vars.palette.primary.main
    : theme.vars.palette.divider,
  backgroundColor: $selected
    ? 'rgba(255, 90, 79, 0.08)'
    : 'transparent',
  cursor: 'pointer',
  textAlign: 'center',
  transition: 'border-color 150ms, background-color 150ms',
  '&:hover': {
    borderColor: theme.vars.palette.primary.light,
  },
}));

interface ProductConfigSectionProps {
  selectedProductTypes: string[];
  onProductTypesChange: (types: string[]) => void;
  selectedFitTypes: string[];
  onFitTypesChange: (fits: string[]) => void;
  printSide: PrintSide;
  onPrintSideChange: (side: PrintSide) => void;
  marketplaces: MarketplaceConfig[];
  onMarketplacesChange: (configs: MarketplaceConfig[]) => void;
}

const ProductConfigSection = ({
  selectedProductTypes,
  onProductTypesChange,
  selectedFitTypes,
  onFitTypesChange,
  printSide,
  onPrintSideChange,
  marketplaces,
  onMarketplacesChange,
}: ProductConfigSectionProps) => {
  const { t } = useTranslation();
  const [showAllColors] = useState(false);

  const toggleProductType = (key: string) => {
    if (selectedProductTypes.includes(key)) {
      onProductTypesChange(selectedProductTypes.filter((k) => k !== key));
    } else {
      onProductTypesChange([...selectedProductTypes, key]);
    }
  };

  const toggleFitType = (fit: string) => {
    if (selectedFitTypes.includes(fit)) {
      onFitTypesChange(selectedFitTypes.filter((f) => f !== fit));
    } else {
      onFitTypesChange([...selectedFitTypes, fit]);
    }
  };

  const toggleMarketplace = (code: string) => {
    const existing = marketplaces.find((m) => m.marketplace === code);
    if (existing) {
      onMarketplacesChange(
        marketplaces.map((m) =>
          m.marketplace === code ? { ...m, enabled: !m.enabled } : m,
        ),
      );
    } else {
      onMarketplacesChange([
        ...marketplaces,
        { marketplace: code, price: '', enabled: true },
      ]);
    }
  };

  const updatePrice = (code: string, price: string) => {
    onMarketplacesChange(
      marketplaces.map((m) =>
        m.marketplace === code ? { ...m, price } : m,
      ),
    );
  };

  return (
    <Box component="section" aria-label={t('publish.product.title')}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {t('publish.product.title')}
      </Typography>

      {/* Product Types Grid */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('publish.product.types')}
      </Typography>
      <Grid container spacing={1.5} sx={{ mb: 3 }}>
        {MBA_PRODUCT_TYPES.map((pt) => (
          <Grid key={pt.key} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
            <ProductTypeCard
              $selected={selectedProductTypes.includes(pt.key)}
              onClick={() => toggleProductType(pt.key)}
              role="checkbox"
              aria-checked={selectedProductTypes.includes(pt.key)}
              aria-label={pt.label}
            >
              <Typography variant="body2">{pt.label}</Typography>
              {selectedProductTypes.includes(pt.key) && (
                <Chip label="1" size="small" color="primary" sx={{ mt: 0.5 }} />
              )}
            </ProductTypeCard>
          </Grid>
        ))}
      </Grid>

      {/* Fit Types */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('publish.product.fitType')}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {MBA_FIT_TYPES.map((fit) => (
          <Chip
            key={fit}
            label={fit}
            onClick={() => toggleFitType(fit)}
            color={selectedFitTypes.includes(fit) ? 'primary' : 'default'}
            variant={selectedFitTypes.includes(fit) ? 'filled' : 'outlined'}
          />
        ))}
      </Box>

      {/* Print Side */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('publish.product.printSide')}
      </Typography>
      <ToggleButtonGroup
        value={printSide}
        exclusive
        onChange={(_, val) => val && onPrintSideChange(val as PrintSide)}
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="front">{t('publish.product.front')}</ToggleButton>
        <ToggleButton value="back">{t('publish.product.back')}</ToggleButton>
        <ToggleButton value="both">{t('publish.product.both')}</ToggleButton>
      </ToggleButtonGroup>

      {/* Colors placeholder */}
      {showAllColors && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t('publish.product.colorsComingSoon')}
        </Typography>
      )}

      {/* Marketplaces */}
      <Typography variant="h6" sx={{ mb: 1.5 }}>
        {t('publish.marketplace.title')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {MBA_MARKETPLACES.map((mp) => {
          const config = marketplaces.find((m) => m.marketplace === mp.code);
          const enabled = config?.enabled ?? false;

          return (
            <Box
              key={mp.code}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                p: 1.5,
                borderRadius: '8px',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={enabled}
                    onChange={() => toggleMarketplace(mp.code)}
                    size="small"
                  />
                }
                label={
                  <Typography variant="body2">{mp.label}</Typography>
                }
                sx={{ flex: 1 }}
              />
              {enabled && (
                <TextField
                  size="small"
                  label={`${t('publish.marketplace.price')} (${mp.currency})`}
                  value={config?.price ?? ''}
                  onChange={(e) => updatePrice(mp.code, e.target.value)}
                  type="number"
                  sx={{ width: 140 }}
                />
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default ProductConfigSection;
