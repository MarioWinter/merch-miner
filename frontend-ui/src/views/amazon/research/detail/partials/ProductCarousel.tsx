import { useRef, useCallback } from 'react';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarIcon from '@mui/icons-material/Star';
import { useNavigate } from 'react-router-dom';
import type { SimilarProduct } from '../../types';

interface ProductCarouselProps {
  title: string;
  products: SimilarProduct[];
  emptyMessage?: string;
}

const ScrollContainer = styled(Box)({
  display: 'flex',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  gap: 12,
  paddingBottom: 4,
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': { height: 4 },
});

const MiniCard = styled(Box)(({ theme }) => ({
  minWidth: 200,
  maxWidth: 200,
  scrollSnapAlign: 'start',
  backgroundColor: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 8,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'transform 150ms ease',
  '&:hover': {
    transform: 'translateY(-2px)',
  },
}));

const MiniImg = styled('img')(({ theme }) => ({
  width: '100%',
  height: 120,
  objectFit: 'cover',
  display: 'block',
  backgroundColor: theme.vars.palette.background.default,
}));

const NavButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.vars.palette.background.paper,
  '&:hover': {
    backgroundColor: theme.vars.palette.background.paper,
  },
}));

const ProductCarousel = ({
  title,
  products,
  emptyMessage = 'No products found',
}: ProductCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = direction === 'left' ? -220 : 220;
    scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  }, []);

  if (products.length === 0) {
    return (
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.disabled">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">{title}</Typography>
        <Stack direction="row" spacing={0.5}>
          <NavButton size="small" onClick={() => scroll('left')} aria-label="Scroll left">
            <ChevronLeftIcon sx={{ fontSize: 20 }} />
          </NavButton>
          <NavButton size="small" onClick={() => scroll('right')} aria-label="Scroll right">
            <ChevronRightIcon sx={{ fontSize: 20 }} />
          </NavButton>
        </Stack>
      </Stack>

      <ScrollContainer ref={scrollRef}>
        {products.map((p) => (
          <MiniCard
            key={p.asin}
            onClick={() => navigate(`/amazon/research/product/${p.asin}`)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === 'Enter' && navigate(`/amazon/research/product/${p.asin}`)
            }
            aria-label={`View product ${p.asin}`}
          >
            <MiniImg
              src={p.thumbnail_url || '/placeholder-product.png'}
              alt={p.title || p.asin}
              loading="lazy"
            />
            <Box sx={{ p: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                {p.bsr !== null && (
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 600,
                      color: p.bsr < 10000
                        ? 'success.main'
                        : p.bsr <= 50000
                          ? 'warning.main'
                          : 'text.secondary',
                    }}
                  >
                    <TrendingUpIcon sx={{ fontSize: 12, mr: 0.25, verticalAlign: 'text-bottom' }} />
                    {p.bsr.toLocaleString()}
                  </Typography>
                )}
                {p.price !== null && (
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    ${Number(p.price).toFixed(2)}
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                {p.reviews_count !== null && (
                  <Stack direction="row" alignItems="center" spacing={0.25}>
                    <StarIcon sx={{ fontSize: 12, color: 'warning.main' }} />
                    <Typography variant="caption" color="text.secondary">
                      {p.reviews_count.toLocaleString()}
                    </Typography>
                  </Stack>
                )}
                {p.listed_date && (
                  <Typography variant="caption" color="text.secondary">
                    {new Date(p.listed_date).toLocaleDateString()}
                  </Typography>
                )}
              </Stack>
            </Box>
          </MiniCard>
        ))}
      </ScrollContainer>
    </Box>
  );
};

export default ProductCarousel;
