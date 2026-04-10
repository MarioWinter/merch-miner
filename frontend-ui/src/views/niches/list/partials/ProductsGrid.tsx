import { useState, useCallback } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import {
  useGetCollectedProductsQuery,
  useRemoveCollectedProductMutation,
  useExtractKeywordsMutation,
} from '@/store/collectedProductsSlice';
import { BulkFlowButton } from '@/components/FlowButton';
import { ProjectNamingDialog } from '@/views/designs/board/partials/ProjectNamingDialog';
import { useProductToCanvas } from '../hooks/useProductToCanvas';
import ProductThumbnailCard from './ProductThumbnailCard';

interface ProductsGridProps {
  nicheId: string;
  nicheName?: string;
}

// ── Styled Components ─────────────────────────────────────────────
const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: theme.spacing(1.5),
}));

const SkeletonGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: theme.spacing(1.5),
}));

// ── Component ─────────────────────────────────────────────────────
const ProductsGrid = ({ nicheId, nicheName }: ProductsGridProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const { data: collectedData, isLoading } = useGetCollectedProductsQuery(nicheId, {
    skip: !nicheId,
  });
  const [removeProduct] = useRemoveCollectedProductMutation();
  const [extractKeywords] = useExtractKeywordsMutation();

  const {
    sendToCanvas,
    dialogOpen,
    closeDialog,
    handleProjectSelected,
    dialogNicheId,
    dialogNicheName,
  } = useProductToCanvas({ nicheId, nicheName });

  const products = collectedData?.results ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const anySelected = selectedIds.size > 0;

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleKeywords = useCallback(
    async (collectedProductId: string) => {
      try {
        await extractKeywords({ nicheId, collectedProductId }).unwrap();
        enqueueSnackbar(t('niches.drawer.collectedProducts.keywordsExtracted'), {
          variant: 'success',
        });
      } catch {
        enqueueSnackbar(t('niches.drawer.collectedProducts.keywordsExtractFailed'), {
          variant: 'error',
        });
      }
    },
    [extractKeywords, nicheId, enqueueSnackbar, t],
  );

  const handleDetail = useCallback(
    (asin: string) => {
      navigate(`/amazon/research/product/${asin}`);
    },
    [navigate],
  );

  const handleRemoveSingle = useCallback(
    async (collectedProductId: string) => {
      try {
        await removeProduct({ nicheId, collectedProductId }).unwrap();
      } catch {
        enqueueSnackbar(t('niches.drawer.collectedProducts.removeFailed'), { variant: 'error' });
      }
    },
    [removeProduct, nicheId, enqueueSnackbar, t],
  );

  // ── Loading ─────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SkeletonGrid>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rectangular"
            sx={{ aspectRatio: '1/1', borderRadius: 1 }}
          />
        ))}
      </SkeletonGrid>
    );
  }

  // ── Empty ───────────────────────────────────────────────────────
  if (products.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        {t('niches.drawer.collectedProducts.empty')}
      </Typography>
    );
  }

  return (
    <Box>
      <GridContainer>
        {products.map((cp) => (
          <ProductThumbnailCard
            key={cp.id}
            thumbnailUrl={cp.product.thumbnail_url}
            title={cp.product.title}
            bsr={cp.product.bsr}
            price={cp.product.price}
            selected={selectedIds.has(cp.id)}
            anySelected={anySelected}
            onSelect={() => toggleSelect(cp.id)}
            onKeywords={() => handleKeywords(cp.id)}
            onSlogans={() => {/* TODO: PROJ-8 slogan flow */}}
            onCanvas={() => sendToCanvas([cp.product.id])}
            hasImage={Boolean(cp.product.thumbnail_url)}
            onDetail={() => handleDetail(cp.product.asin)}
            onRemove={() => handleRemoveSingle(cp.id)}
          />
        ))}
      </GridContainer>

      {anySelected && (
        <Box sx={{ mt: 1.5 }}>
          <BulkFlowButton
            target="canvas"
            label={t('niches.drawer.collectedProducts.sendToCanvas', { count: selectedIds.size })}
            count={selectedIds.size}
            onClick={() => {
              const productIds = products
                .filter((cp) => selectedIds.has(cp.id) && cp.product.thumbnail_url)
                .map((cp) => cp.product.id);
              if (productIds.length > 0) sendToCanvas(productIds);
            }}
          />
        </Box>
      )}

      <ProjectNamingDialog
        open={dialogOpen}
        onClose={closeDialog}
        onProjectSelected={handleProjectSelected}
        nicheName={dialogNicheName}
        nicheId={dialogNicheId}
      />
    </Box>
  );
};

export { ProductsGrid };
