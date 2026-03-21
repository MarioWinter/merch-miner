import { useState, useCallback, Fragment } from 'react';
import { Grid } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCreateNicheMutation } from '../../../../store/nicheSlice';
import type { AmazonProduct } from '../types';
import ProductCard from './ProductCard';
import ProductDetailPanel from './ProductDetailPanel';

interface ProductGridProps {
  products: AmazonProduct[];
  keyword: string;
}

const ProductGrid = ({ products, keyword }: ProductGridProps) => {
  const [expandedAsin, setExpandedAsin] = useState<string | null>(null);
  const { enqueueSnackbar } = useSnackbar();
  const [createNiche] = useCreateNicheMutation();

  const handleToggleExpand = useCallback((asin: string) => {
    setExpandedAsin((prev) => (prev === asin ? null : asin));
  }, []);

  const handleAddToNiche = useCallback(
    async (kw: string) => {
      try {
        await createNiche({ name: kw }).unwrap();
        enqueueSnackbar('Added to niche list', { variant: 'success' });
      } catch {
        enqueueSnackbar('Failed to add niche', { variant: 'error' });
      }
    },
    [createNiche, enqueueSnackbar],
  );

  const expandedProduct = products.find((p) => p.asin === expandedAsin);

  return (
    <Grid container spacing={2}>
      {products.map((product) => (
        <Fragment key={product.asin}>
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ProductCard
              product={product}
              onAddToNiche={() => handleAddToNiche(keyword)}
              isExpanded={expandedAsin === product.asin}
              onToggleExpand={() => handleToggleExpand(product.asin)}
            />
          </Grid>
          {expandedAsin === product.asin && expandedProduct && (
            <Grid size={{ xs: 12 }}>
              <ProductDetailPanel product={expandedProduct} keyword={keyword} />
            </Grid>
          )}
        </Fragment>
      ))}
    </Grid>
  );
};

export default ProductGrid;
