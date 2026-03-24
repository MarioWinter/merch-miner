import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import StarIcon from '@mui/icons-material/Star';
import { MONO_FONT_STACK } from '../../../../style/constants';
import { MARKETPLACE_OPTIONS, type AmazonProduct } from '../types';

interface ProductCardProps {
  product: AmazonProduct;
  onAddToNiche: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius: 12,
  cursor: 'pointer',
  transition: 'transform 150ms ease, box-shadow 150ms ease',
  '&:hover': {
    transform: 'translateY(-1px)',
    boxShadow: `0 4px 16px rgba(0,0,0,0.30)`,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ...theme.applyStyles('light', {
    '&:hover': {
      boxShadow: `0 4px 12px rgba(7,30,38,0.10)`,
    },
  }),
}));

const TitleText = styled(Typography)({
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
});

const getBsrColor = (bsr: number | null): 'success' | 'warning' | 'default' => {
  if (bsr === null) return 'default';
  if (bsr < 10000) return 'success';
  if (bsr <= 50000) return 'warning';
  return 'default';
};

const getDaysSince = (dateStr: string | null): string => {
  if (!dateStr) return 'N/A';
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
  return `${days}d`;
};

const getAmazonUrl = (marketplace: string, asin: string): string => {
  const mp = MARKETPLACE_OPTIONS.find((m) => m.value === marketplace);
  const domain = mp?.domain ?? 'amazon.com';
  return `https://www.${domain}/dp/${asin}`;
};

const ProductCard = ({
  product,
  onAddToNiche,
  isExpanded,
  onToggleExpand,
}: ProductCardProps) => {
  const bsrColor = getBsrColor(product.bsr);

  return (
    <StyledCard
      onClick={onToggleExpand}
      elevation={isExpanded ? 3 : 0}
      aria-expanded={isExpanded}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onToggleExpand()}
    >
      <CardMedia
        component="img"
        image={product.thumbnail_url || '/placeholder-product.png'}
        alt={product.title}
        sx={{ height: 200, objectFit: 'cover' }}
      />
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack spacing={0.5}>
          {product.bsr !== null && (
            <Chip
              label={`BSR ${product.bsr.toLocaleString()}`}
              size="small"
              color={bsrColor}
              sx={{ alignSelf: 'flex-start' }}
            />
          )}

          <TitleText variant="body2">{product.title}</TitleText>

          <Typography variant="caption" color="text.secondary">
            {product.brand}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={0.5}>
            {product.rating !== null && (
              <>
                <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                <Typography variant="caption">
                  {Number(product.rating).toFixed(1)}
                </Typography>
              </>
            )}
            {product.reviews_count !== null && (
              <Typography variant="caption" color="text.secondary">
                ({product.reviews_count.toLocaleString()})
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            {product.price !== null && (
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                ${Number(product.price).toFixed(2)}
              </Typography>
            )}
          </Stack>

          <Typography variant="caption" color="text.secondary">
            Published {getDaysSince(product.listed_date)} ago
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontFamily: MONO_FONT_STACK }}
          >
            {product.asin}
          </Typography>

          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button
              size="small"
              variant="text"
              onClick={(e) => {
                e.stopPropagation();
                onAddToNiche();
              }}
              aria-label="Add to niche"
            >
              Add to Niche
            </Button>
            <IconButton
              size="small"
              component="a"
              href={getAmazonUrl(product.marketplace, product.asin)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              aria-label="Open on Amazon"
            >
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>
    </StyledCard>
  );
};

export default ProductCard;
