import { useCallback } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
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
}

const GridContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(2),
  justifyContent: 'center',
}));

const ProductGrid = ({
  products,
  favoriteAsins,
  extractedAsins,
  extractingAsin,
  onToggleFavorite,
  onExtractSlogan,
  onDoubleClick,
}: ProductGridProps) => {
  const handleCardClick = useCallback((asin: string) => {
    window.open(`/amazon/research/product/${asin}`, '_blank', 'noopener');
  }, []);

  return (
    <GridContainer>
      {products.map((product) => (
        <ProductCard
          key={product.asin}
          product={product}
          onClick={() => handleCardClick(product.asin)}
          onDoubleClick={onDoubleClick ? () => onDoubleClick(product) : undefined}
          isFavorite={favoriteAsins?.has(product.asin)}
          onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(product) : undefined}
          hasSloganExtracted={extractedAsins?.has(product.asin)}
          onExtractSlogan={onExtractSlogan ? () => onExtractSlogan(product) : undefined}
          isExtracting={extractingAsin === product.asin}
        />
      ))}
    </GridContainer>
  );
};

export default ProductGrid;
