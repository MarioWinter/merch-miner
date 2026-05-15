/**
 * PROJ-30 T3.10 — vertical card list for Amazon Research results on
 * `<744px` viewports. Mirrors the visible columns of ProductTable.
 */
import { Box, Chip, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import StarIcon from '@mui/icons-material/Star';
import { useTranslation } from 'react-i18next';
import { MobileCard } from '@/components/MobileCard';
import { MONO_FONT_STACK } from '@/style/constants';
import type { AmazonProduct } from '../types';

interface ProductCardListProps {
  products: AmazonProduct[];
  onSelect?: (product: AmazonProduct) => void;
}

const Thumb = styled('img')(({ theme }) => ({
  width: 56,
  height: 70,
  objectFit: 'cover',
  borderRadius: 6,
  flexShrink: 0,
  border: `1px solid ${theme.vars.palette.divider}`,
}));

const TitleCluster = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 12,
  minWidth: 0,
  flex: 1,
});

const TitleText = styled(Typography)({
  fontWeight: 600,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
});

const RatingBox = styled(Stack)({
  flexDirection: 'row',
  alignItems: 'center',
  gap: 4,
});

const getBsrColor = (
  bsr: number | null,
): 'success' | 'warning' | 'default' => {
  if (bsr === null) return 'default';
  if (bsr < 10_000) return 'success';
  if (bsr <= 50_000) return 'warning';
  return 'default';
};

export const ProductCardList = ({ products, onSelect }: ProductCardListProps) => {
  const { t } = useTranslation();

  const handleActivate = (product: AmazonProduct) => {
    if (onSelect) {
      onSelect(product);
      return;
    }
    window.open(`/amazon/research/product/${product.asin}`, '_blank', 'noopener');
  };

  return (
    <Stack spacing={1} role="list" aria-label="Amazon products">
      {products.map((product) => {
        const priceLabel = product.price != null ? Number(product.price).toFixed(2) : '—';
        const reviewLabel =
          product.reviews_count != null ? product.reviews_count.toLocaleString() : '0';
        const bsrLabel = product.bsr != null ? product.bsr.toLocaleString() : '—';

        const primaryMeta = product.price != null
          ? t('responsive.cardList.product.metaBsr', {
              bsr: bsrLabel,
              price: priceLabel,
              reviews: reviewLabel,
            })
          : t('responsive.cardList.product.metaBsrNoPrice', {
              bsr: bsrLabel,
              reviews: reviewLabel,
            });

        return (
          <MobileCard
            key={product.asin}
            title={
              <TitleCluster>
                <Thumb
                  src={product.thumbnail_url || '/placeholder-product.png'}
                  alt=""
                  loading="lazy"
                />
                <Box sx={{ minWidth: 0 }}>
                  <TitleText variant="body1">{product.title}</TitleText>
                  {product.rating != null && (
                    <RatingBox sx={{ pt: 0.5 }}>
                      <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                      <Typography variant="caption" color="text.secondary">
                        {Number(product.rating).toFixed(1)}
                      </Typography>
                    </RatingBox>
                  )}
                </Box>
              </TitleCluster>
            }
            primaryMeta={primaryMeta}
            secondaryMeta={
              <Box component="span" sx={{ fontFamily: MONO_FONT_STACK }}>
                {t('responsive.cardList.product.asin', { asin: product.asin })}
              </Box>
            }
            chips={
              <>
                {product.bsr != null && (
                  <Chip
                    label={`BSR ${product.bsr.toLocaleString()}`}
                    size="small"
                    color={getBsrColor(product.bsr)}
                    variant="outlined"
                  />
                )}
                {product.product_type && (
                  <Chip label={product.product_type} size="small" variant="outlined" />
                )}
              </>
            }
            onActivate={() => handleActivate(product)}
          />
        );
      })}
    </Stack>
  );
};

export default ProductCardList;
