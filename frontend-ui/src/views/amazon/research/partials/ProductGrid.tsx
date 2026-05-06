import { forwardRef, useCallback, useMemo } from 'react';
import { Box, Skeleton, Stack } from '@mui/material';
import { styled } from '@mui/material/styles';
import { VirtuosoGrid } from 'react-virtuoso';
import type { AmazonProduct } from '../types';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: AmazonProduct[];
  favoriteAsins?: Set<string>;
  extractedAsins?: Set<string>;
  extractingAsin?: string | null;
  onToggleFavorite?: (product: AmazonProduct) => void;
  onExtractSlogan?: (product: AmazonProduct) => void;
  onDoubleClick?: (product: AmazonProduct) => void;
  /** Called when the user scrolls to the end — only when `hasMore` is true. */
  onEndReached?: () => void;
  /** Show skeleton row footer while next page is loading. */
  isFetchingNext?: boolean;
  /** When false the footer skeleton is never rendered. */
  hasMore?: boolean;
}

// ProductCard has a fixed width of 215px; we use auto-fill grid so as many
// cards as fit per row are rendered. minmax(235px, 1fr) leaves a small gutter
// around the card and lets cells stretch to fill available row space.
const GRID_MIN_COL = 235;

/**
 * Virtuoso `List` slot — CSS Grid container with auto-fill columns.
 * Replaces the previous breakpoint-stepped flex-wrap (which capped at 5 cards
 * even on ultra-wide displays) with viewport-driven density.
 */
const VirtuosoList = styled('div')(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: `repeat(auto-fill, minmax(${GRID_MIN_COL}px, 1fr))`,
  gap: theme.spacing(2),
  justifyItems: 'center',
}));

/**
 * Virtuoso `Item` slot — each grid cell. Cards center inside the cell.
 */
const VirtuosoItem = styled('div')({
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
});

/**
 * Skeleton card — matches ProductCard fixed 370px height so layout doesn't jump
 * while the next page loads.
 */
const SkeletonCard = () => (
  <Box sx={{ width: 215 }}>
    <Skeleton
      variant="rectangular"
      animation="wave"
      sx={{ height: 340, borderRadius: 2 }}
    />
  </Box>
);

const SkeletonList = forwardRef<HTMLDivElement, { count?: number }>(
  ({ count = 4 }, ref) => (
    <VirtuosoList ref={ref}>
      {Array.from({ length: count }).map((_, i) => (
        <VirtuosoItem key={`skeleton-${i}`}>
          <SkeletonCard />
        </VirtuosoItem>
      ))}
    </VirtuosoList>
  ),
);
SkeletonList.displayName = 'SkeletonList';

const ProductGrid = ({
  products,
  favoriteAsins,
  extractedAsins,
  extractingAsin,
  onToggleFavorite,
  onExtractSlogan,
  onDoubleClick,
  onEndReached,
  isFetchingNext = false,
  hasMore = false,
}: ProductGridProps) => {
  const handleCardClick = useCallback((asin: string) => {
    window.open(`/amazon/research/product/${asin}`, '_blank', 'noopener');
  }, []);

  const itemContent = useCallback(
    (index: number) => {
      const product = products[index];
      if (!product) return null;
      return (
        <ProductCard
          product={product}
          onClick={() => handleCardClick(product.asin)}
          onDoubleClick={onDoubleClick ? () => onDoubleClick(product) : undefined}
          isFavorite={favoriteAsins?.has(product.asin)}
          onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(product) : undefined}
          hasSloganExtracted={extractedAsins?.has(product.asin)}
          onExtractSlogan={onExtractSlogan ? () => onExtractSlogan(product) : undefined}
          isExtracting={extractingAsin === product.asin}
        />
      );
    },
    [
      products,
      handleCardClick,
      onDoubleClick,
      favoriteAsins,
      onToggleFavorite,
      extractedAsins,
      onExtractSlogan,
      extractingAsin,
    ],
  );

  // Footer skeleton row (visible while the next page is loading).
  const Footer = useCallback(
    () =>
      isFetchingNext && hasMore ? (
        <Stack direction="row" gap={2} flexWrap="wrap" justifyContent="center" sx={{ pt: 2 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={`footer-skel-${i}`} />
          ))}
        </Stack>
      ) : null,
    [isFetchingNext, hasMore],
  );

  const components = useMemo(
    () => ({
      List: VirtuosoList,
      Item: VirtuosoItem,
      Footer,
    }),
    [Footer],
  );

  // Internal scroll container — the AppLayout root has `overflow: hidden`
  // (see frontend-ui/src/components/AppLayout.tsx), so the document never
  // scrolls and `useWindowScroll` would leave endReached firing only once at
  // mount. Owning the scroller here keeps endReached working for every page.
  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        // Account for: topbar (56) + outer padding (24) + filter row + tabs.
        // 280px is a conservative reserve so the grid fills available space.
        height: 'calc(100dvh - 280px)',
        width: '100%',
      }}
    >
      <VirtuosoGrid
        totalCount={products.length}
        data-testid="product-virtuoso-grid"
        increaseViewportBy={400}
        endReached={onEndReached}
        itemContent={itemContent}
        components={components}
        style={{ height: '100%' }}
      />
    </Box>
  );
};

export default ProductGrid;
