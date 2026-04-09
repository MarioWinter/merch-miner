import { useState, useCallback } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import {
  useGetCollectedProductsQuery,
  useRemoveCollectedProductMutation,
  useExtractKeywordsMutation,
} from '@/store/collectedProductsSlice';
import { BulkFlowButton } from '@/components/FlowButton';
import { COLORS, DURATION, EASING } from '@/style/constants';
import ProductThumbnailCard from './ProductThumbnailCard';

interface ProductsGridProps {
  nicheId: string;
}

// ── Styled Components ─────────────────────────────────────────────
const GridContainer = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(1.5),
}));

const AddCard = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  aspectRatio: '1 / 1',
  borderRadius: theme.shape.borderRadius,
  border: `1px dashed ${alpha('#fff', 0.12)}`,
  cursor: 'pointer',
  transition: `border-color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.3),
    '& .add-icon': {
      color: COLORS.cyan,
    },
  },
  ...theme.applyStyles('light', {
    border: `1px dashed ${alpha(COLORS.ink, 0.12)}`,
    '&:hover': {
      borderColor: alpha(COLORS.teal, 0.3),
    },
  }),
}));

const SkeletonGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: theme.spacing(1.5),
}));

// ── Component ─────────────────────────────────────────────────────
const ProductsGrid = ({ nicheId }: ProductsGridProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();

  const { data: collectedData, isLoading } = useGetCollectedProductsQuery(nicheId, {
    skip: !nicheId,
  });
  const [removeProduct] = useRemoveCollectedProductMutation();
  const [extractKeywords] = useExtractKeywordsMutation();

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

  const handleRemoveSelected = useCallback(async () => {
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) => removeProduct({ nicheId, collectedProductId: id }).unwrap()),
      );
      setSelectedIds(new Set());
    } catch {
      enqueueSnackbar(t('niches.drawer.collectedProducts.removeFailed'), {
        variant: 'error',
      });
    }
  }, [selectedIds, removeProduct, nicheId, enqueueSnackbar, t]);

  const handleAddProduct = useCallback(() => {
    navigate(`/amazon/research?niche=${nicheId}`);
  }, [navigate, nicheId]);

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
            onCanvas={() => {/* TODO: PROJ-9 canvas flow */}}
            onDetail={() => handleDetail(cp.product.asin)}
          />
        ))}

        {products.length < 6 && (
          <AddCard onClick={handleAddProduct} role="button" aria-label={t('niches.drawer.collectedProducts.addProduct')}>
            <AddCircleOutlineIcon
              className="add-icon"
              sx={{ fontSize: 32, color: 'text.disabled', transition: `color ${DURATION.fast}ms ${EASING.standard}` }}
            />
          </AddCard>
        )}
      </GridContainer>

      {anySelected && (
        <Box sx={{ mt: 1.5 }}>
          <BulkFlowButton
            target="canvas"
            label={t('niches.drawer.collectedProducts.sendToCanvas', { count: selectedIds.size })}
            count={selectedIds.size}
            onClick={handleRemoveSelected}
          />
        </Box>
      )}
    </Box>
  );
};

export { ProductsGrid };
