import { useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import tinycolor from 'tinycolor2';
import { skipToken } from '@reduxjs/toolkit/query';
import { COLORS, DURATION, EASING } from '@/style/constants';
import {
  useGetMbaProductCatalogQuery,
  useGetProductConfigQuery,
} from '@/store/publishSlice';
import type { MarketplaceType, MbaColor } from '../../types';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const GridWrap = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.25),
  paddingBlock: theme.spacing(0.5),
}));

const Swatch = styled('button', {
  shouldForwardProp: (prop) => prop !== 'selected' && prop !== 'hex',
})<{ selected: boolean; hex: string }>(({ selected, hex }) => ({
  position: 'relative',
  width: 36,
  height: 36,
  borderRadius: '9999px',
  backgroundColor: hex,
  border: selected
    ? `2px solid ${COLORS.cyan}`
    : `1px solid ${alpha(COLORS.white, 0.18)}`,
  padding: 0,
  cursor: 'pointer',
  transform: selected ? 'scale(1.1)' : 'scale(1)',
  boxShadow: selected ? `0 0 0 4px ${alpha(COLORS.cyan, 0.3)}` : 'none',
  transition: `transform ${DURATION.fast}ms ${EASING.standard}, box-shadow ${DURATION.fast}ms ${EASING.standard}, border-color ${DURATION.fast}ms ${EASING.standard}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover': {
    transform: selected ? 'scale(1.12)' : 'scale(1.05)',
  },
  '&:focus-visible': {
    outline: `2px solid ${alpha(COLORS.cyan, 0.8)}`,
    outlineOffset: 3,
  },
}));

const SkeletonGrid = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(1.25),
  paddingBlock: theme.spacing(0.5),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isDarkColor = (hex: string): boolean => {
  const color = tinycolor(hex);
  if (!color.isValid()) return true;
  return color.getBrightness() < 128;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ColorGridProps {
  designId: string | null;
  marketplaceType: MarketplaceType;
  focusedProduct: string | null;
  /** Race-safe per-color toggle — derives next list from the latest
   *  server state inside useEditFormState, not from a stale closure. */
  toggleColor: (productKey: string, colorKey: string) => Promise<void> | void;
}

const ColorGrid = ({
  designId,
  marketplaceType,
  focusedProduct,
  toggleColor,
}: ColorGridProps) => {
  const { t } = useTranslation();
  const {
    data: catalog,
    isLoading,
    isError,
    refetch,
  } = useGetMbaProductCatalogQuery();
  const { data: productConfig } = useGetProductConfigQuery(
    designId ? { designId, marketplace_type: marketplaceType } : skipToken,
  );

  const { palette, selected } = useMemo(() => {
    if (!focusedProduct) {
      return { palette: [] as MbaColor[], selected: [] as string[] };
    }
    const catEntry = catalog?.find((c) => c.key === focusedProduct);
    if (!catEntry || !catEntry.supports.includes('colors')) {
      return { palette: [] as MbaColor[], selected: [] as string[] };
    }
    const cfgEntry = productConfig?.products_config?.find(
      (e) => e.product_type === focusedProduct,
    );
    return {
      palette: catEntry.colors_options,
      selected: cfgEntry?.colors ?? [],
    };
  }, [catalog, productConfig?.products_config, focusedProduct]);

  // Nothing focused OR the focused product doesn't support colors →
  // render nothing. Prevents an empty section from eating vertical space.
  if (!focusedProduct) return null;
  const catalogEntry = catalog?.find((c) => c.key === focusedProduct);
  const supportsColors =
    catalogEntry?.supports.includes('colors') ?? false;
  // While the catalog is still loading we can't know yet whether the focused
  // product supports colors — render the loading skeleton rather than `null`.
  if (!isLoading && catalogEntry && !supportsColors) return null;

  const toggle = (key: string) => {
    if (!focusedProduct) return;
    void toggleColor(focusedProduct, key);
  };

  return (
    <Stack
      component="section"
      gap={0.5}
      data-testid="ColorGrid"
      data-focused-product={focusedProduct}
    >
      <Typography variant="overline" color="text.secondary">
        {t('publish.edit.colors.title', { defaultValue: 'Colors' })}
      </Typography>

      {isLoading && (
        <SkeletonGrid aria-busy="true" aria-live="polite">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="circular"
              width={36}
              height={36}
              animation="wave"
            />
          ))}
        </SkeletonGrid>
      )}

      {isError && !isLoading && (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                void refetch();
              }}
            >
              {t('publish.edit.colors.retry', { defaultValue: 'Retry' })}
            </Button>
          }
        >
          {t('publish.edit.colors.loadError', {
            defaultValue: 'Failed to load colors.',
          })}
        </Alert>
      )}

      {!isLoading && !isError && palette.length > 0 && (
        <GridWrap
          role="group"
          aria-label={t('publish.edit.colors.title', {
            defaultValue: 'Colors',
          })}
        >
          {palette.map((c) => {
            const isSelected = selected.includes(c.key);
            const checkColor = isDarkColor(c.hex) ? COLORS.white : COLORS.ink;
            return (
              <Tooltip key={c.key} title={c.name} arrow placement="top">
                <Swatch
                  type="button"
                  selected={isSelected}
                  hex={c.hex}
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={t('publish.edit.colors.swatch', {
                    defaultValue: '{{name}}',
                    name: c.name,
                  })}
                  data-testid={`ColorGrid-swatch-${c.key}`}
                  onClick={() => toggle(c.key)}
                >
                  {isSelected && (
                    <CheckIcon sx={{ fontSize: 20, color: checkColor }} />
                  )}
                </Swatch>
              </Tooltip>
            );
          })}
        </GridWrap>
      )}
    </Stack>
  );
};

export default ColorGrid;
