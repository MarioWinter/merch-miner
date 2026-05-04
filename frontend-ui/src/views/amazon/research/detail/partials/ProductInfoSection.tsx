import { useState } from 'react';
import { Box, Button, Chip, Grid, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import LanguageIcon from '@mui/icons-material/Language';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CategoryIcon from '@mui/icons-material/Category';
import { useTranslation } from 'react-i18next';
import type { ProductDetail, BSRSummary, BSRSnapshot, BSRCategory } from '../../types';
import BSRChart from './BSRChart';

interface ProductInfoSectionProps {
  product: ProductDetail;
  bsrSnapshots: BSRSnapshot[];
  bsrSummary: BSRSummary | null;
  bsrCategories: BSRCategory[] | undefined;
}

const ProductImg = styled('img')(({ theme }) => ({
  width: 300,
  height: 300,
  objectFit: 'contain',
  borderRadius: 12,
  backgroundColor: theme.vars.palette.background.default,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const PlaceholderBox = styled(Box)(({ theme }) => ({
  width: 300,
  height: 300,
  borderRadius: 12,
  backgroundColor: theme.vars.palette.background.default,
  border: `1px solid ${theme.vars.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const DESCRIPTION_MAX = 200;

const ProductInfoSection = ({
  product,
  bsrSnapshots,
  bsrSummary,
  bsrCategories,
}: ProductInfoSectionProps) => {
  const { t } = useTranslation();
  const [descExpanded, setDescExpanded] = useState(false);
  const hasLongDescription =
    (product.description?.length ?? 0) > DESCRIPTION_MAX;

  const bullets = [product.bullet_1, product.bullet_2].filter(Boolean);

  return (
    <Grid container spacing={3}>
      {/* Left column: image + product info */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Stack spacing={2}>
          {/* EC-18: No thumbnail placeholder */}
          {product.thumbnail_url ? (
            <ProductImg
              src={product.thumbnail_url}
              alt={product.title}
              loading="lazy"
            />
          ) : (
            <PlaceholderBox>
              <Typography variant="body2" color="text.disabled">
                {t('amazonResearch.detail.noImage')}
              </Typography>
            </PlaceholderBox>
          )}

          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {product.title}
          </Typography>

          <Typography variant="body2" color="text.secondary">
            {product.brand}
          </Typography>

          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: 'wrap', gap: 0.5 }}
          >
            {product.product_type && (
              <Chip
                icon={<CheckroomIcon sx={{ fontSize: 14 }} />}
                label={product.product_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                size="small"
                sx={(theme) => ({
                  backgroundColor: alpha(theme.palette.secondary.main, 0.12),
                  color: theme.vars.palette.secondary.main,
                  borderRadius: '6px',
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.25)}`,
                  '& .MuiChip-icon': { color: theme.vars.palette.secondary.main },
                })}
              />
            )}
            {product.subcategory && (
              <Chip
                icon={<CategoryIcon sx={{ fontSize: 14 }} />}
                label={product.subcategory}
                size="small"
                variant="outlined"
                sx={{ borderRadius: '6px' }}
              />
            )}
            {product.marketplace && (
              <Chip
                icon={<LanguageIcon sx={{ fontSize: 14 }} />}
                label={product.marketplace.replace('_', '.')}
                size="small"
                variant="outlined"
                sx={{ borderRadius: '6px' }}
              />
            )}
            {product.listed_date && (
              <Chip
                icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                label={`Listed ${new Date(product.listed_date).toLocaleDateString()}`}
                size="small"
                variant="outlined"
                sx={{ borderRadius: '6px' }}
              />
            )}
          </Stack>

          {bullets.length > 0 && (
            <Box component="ul" sx={{ pl: 2, m: 0 }}>
              {bullets.map((bullet, idx) => (
                <Typography
                  key={idx}
                  component="li"
                  variant="body2"
                  sx={{ mb: 0.5 }}
                >
                  {bullet}
                </Typography>
              ))}
            </Box>
          )}

          {product.description && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {descExpanded || !hasLongDescription
                  ? product.description
                  : `${product.description.slice(0, DESCRIPTION_MAX)}...`}
              </Typography>
              {hasLongDescription && (
                <Button
                  size="small"
                  onClick={() => setDescExpanded(!descExpanded)}
                  sx={{ mt: 0.5, textTransform: 'none' }}
                >
                  {descExpanded
                    ? t('amazonResearch.detail.showLess')
                    : t('amazonResearch.detail.readMore')}
                </Button>
              )}
            </Box>
          )}
        </Stack>
      </Grid>

      {/* Right column: BSR chart + subcategory ranks + BSR summary */}
      <Grid size={{ xs: 12, md: 7 }}>
        <BSRChart
          snapshots={bsrSnapshots}
          summary={bsrSummary}
          categories={bsrCategories}
        />
      </Grid>
    </Grid>
  );
};

export default ProductInfoSection;
