import { useMemo } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  useGetMbaProductCatalogQuery,
  useGetProductConfigQuery,
} from '@/store/publishSlice';
import { PRODUCT_ICON_MAP } from '@/components/ProductIcons';
import { COLORS, DURATION, EASING } from '@/style/constants';
import type {
  MarketplaceType,
  MbaProductCatalogEntry,
  ProductConfigEntry,
} from '../../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Scroller = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.25),
  overflowX: 'auto',
  paddingBlock: theme.spacing(0.5),
  paddingInline: theme.spacing(0.25),
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': { height: 3 },
  '&::-webkit-scrollbar-track': { backgroundColor: 'transparent' },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.vars.palette.divider,
    borderRadius: 3,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: alpha(COLORS.cyan, 0.5),
  },
}));

// Two visual states: "enabled" (product has at least one active marketplace
// in `products_config`) and "focused" (product currently selected for the
// per-product Fit/Print/Colors/Pricing sections below). They're independent
// — a product can be focused without being enabled, and vice versa.
const ProductCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'enabled' && prop !== 'focused',
})<{ enabled: boolean; focused: boolean }>(({ theme, enabled, focused }) => ({
  position: 'relative',
  flex: '0 0 auto',
  width: 76,
  minHeight: 92,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(0.75),
  padding: theme.spacing(1, 0.75),
  borderRadius: Number(theme.shape.borderRadius),
  borderWidth: focused ? 2 : 1,
  borderStyle: 'solid',
  borderColor: enabled || focused ? COLORS.cyan : theme.vars.palette.divider,
  backgroundColor: enabled ? alpha(COLORS.cyan, 0.08) : 'transparent',
  color: enabled ? COLORS.cyan : theme.vars.palette.text.secondary,
  cursor: 'pointer',
  transition: `border-color ${DURATION.fast}ms ${EASING.standard}, background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.6),
  },
  '&:focus-visible': {
    outline: `2px solid ${alpha(COLORS.cyan, 0.6)}`,
    outlineOffset: 2,
  },
}));

const CardLabel = styled(Typography)({
  lineHeight: 1.2,
  textAlign: 'center',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
});

const CountBadge = styled(Box)({
  position: 'absolute',
  top: 4,
  right: 4,
  minWidth: 18,
  height: 18,
  paddingInline: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 9999,
  backgroundColor: COLORS.cyan,
  color: COLORS.white,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const enabledMarketplacesCount = (entry: ProductConfigEntry | undefined) => {
  if (!entry) return 0;
  // Legacy rows (pre-Phase-J2) may lack `marketplaces`; treat as zero.
  return (entry.marketplaces ?? []).filter((m) => m.enabled).length;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProductTypeScrollerProps {
  designId: string | null;
  marketplaceType: MarketplaceType;
  focusedProduct: string | null;
  onFocusedProductChange: (productKey: string) => void;
  toggleProductEnabled: (
    productKey: string,
    enabled: boolean,
  ) => Promise<void> | void;
}

const ProductTypeScroller = ({
  designId,
  marketplaceType,
  focusedProduct,
  onFocusedProductChange,
  toggleProductEnabled,
}: ProductTypeScrollerProps) => {
  const { t } = useTranslation();
  const { data: catalog = [] } = useGetMbaProductCatalogQuery();
  const { data: productConfig } = useGetProductConfigQuery(
    designId
      ? { designId, marketplace_type: marketplaceType }
      : skipToken,
  );

  const entriesByKey = useMemo(() => {
    const map = new Map<string, ProductConfigEntry>();
    productConfig?.products_config?.forEach((e) => map.set(e.product_type, e));
    return map;
  }, [productConfig?.products_config]);

  // EC-37 click matrix (round 2 P3 fix — focus-vs-toggle clash):
  //  - disabled       → enable + focus (first click on a product)
  //  - enabled, !focused → focus only, keep enabled
  //                       (focusing an already-enabled product must NOT
  //                        disable it — that was the round 2 UX surprise)
  //  - enabled, focused  → disable + let the auto-focus-first-enabled
  //                        pass in useEditFormState pick the next one
  const handleClick = (item: MbaProductCatalogEntry) => {
    const entry = entriesByKey.get(item.key);
    const currentlyEnabled = entry?.enabled ?? false;
    const isFocused = focusedProduct === item.key;

    if (!currentlyEnabled) {
      onFocusedProductChange(item.key);
      void toggleProductEnabled(item.key, true);
      return;
    }
    if (!isFocused) {
      // Already enabled — focus without disabling.
      onFocusedProductChange(item.key);
      return;
    }
    // Enabled + focused → disable. Focus auto-advances via useEditFormState.
    void toggleProductEnabled(item.key, false);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent,
    item: MbaProductCatalogEntry,
  ) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleClick(item);
    }
  };

  return (
    <Stack component="section" gap={0.5}>
      <Typography variant="overline" color="text.secondary">
        {t('publish.edit.products.title', { defaultValue: 'Product Types' })}
      </Typography>
      <Scroller
        role="group"
        aria-label={t('publish.edit.products.title', {
          defaultValue: 'Product Types',
        })}
        data-testid="ProductTypeScroller"
      >
        {catalog.map((item) => {
          const entry = entriesByKey.get(item.key);
          const enabled = entry?.enabled ?? false;
          const focused = focusedProduct === item.key;
          const count = enabledMarketplacesCount(entry);
          const Icon = PRODUCT_ICON_MAP[item.icon_key];
          return (
            <ProductCard
              key={item.key}
              enabled={enabled}
              focused={focused}
              role="checkbox"
              aria-checked={enabled}
              aria-label={item.label}
              tabIndex={0}
              data-testid={`ProductTypeScroller-card-${item.key}`}
              data-enabled={enabled}
              data-focused={focused}
              onClick={() => handleClick(item)}
              onKeyDown={(e) => handleKeyDown(e, item)}
            >
              {Icon ? (
                <Icon size={40} />
              ) : (
                // Safety net if the catalog drifts ahead of PRODUCT_ICON_MAP.
                <Box sx={{ width: 40, height: 40 }} aria-hidden />
              )}
              <CardLabel variant="caption">{item.label}</CardLabel>
              {enabled && count > 0 && (
                <CountBadge
                  data-testid={`ProductTypeScroller-count-${item.key}`}
                >
                  {count}
                </CountBadge>
              )}
            </ProductCard>
          );
        })}
      </Scroller>
    </Stack>
  );
};

export default ProductTypeScroller;
