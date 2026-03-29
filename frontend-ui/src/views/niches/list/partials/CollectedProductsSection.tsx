import { useState, useCallback, useRef, useEffect } from 'react';
import { Box, IconButton, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  useGetCollectedProductsQuery,
  useRemoveCollectedProductMutation,
  useExtractKeywordsMutation,
  useSaveListingTemplateMutation,
} from '@/store/collectedProductsSlice';
import { MARKETPLACE_OPTIONS } from '@/views/amazon/research/types';
import ProductCard from '@/views/amazon/research/partials/ProductCard';
import { EASING, DURATION } from '@/style/constants';

interface CollectedProductsSectionProps {
  nicheId: string;
}

/* ── Styled Components ── */

const Section = styled(Box)(({ theme }) => ({
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  padding: 16,
  background: 'rgba(11,39,49,0.40)',
  ...theme.applyStyles('light', {
    background: theme.vars.palette.background.paper,
  }),
}));

const SectionHeader = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}));

const CountBadge = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 22,
  height: 20,
  borderRadius: 10,
  padding: '0 6px',
  fontSize: '0.7rem',
  fontWeight: 600,
  backgroundColor: alpha(theme.palette.secondary.main, 0.15),
  color: theme.vars.palette.secondary.main,
}));

const CarouselContainer = styled(Box)({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
});


const CardSlide = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'slideDir',
})<{ slideDir: 'enter' | 'idle' | 'exit-left' | 'exit-right' }>(
  ({ slideDir }) => {
    const transitions = `opacity ${DURATION.default}ms ${EASING.standard}, transform ${DURATION.default}ms ${EASING.standard}`;
    const base = { transition: transitions, display: 'flex', justifyContent: 'center' };

    switch (slideDir) {
      case 'enter':
        return { ...base, opacity: 1, transform: 'translateX(0) scale(1)' };
      case 'exit-left':
        return { ...base, opacity: 0, transform: 'translateX(-20px) scale(0.95)' };
      case 'exit-right':
        return { ...base, opacity: 0, transform: 'translateX(20px) scale(0.95)' };
      default:
        return { ...base, opacity: 1, transform: 'translateX(0) scale(1)' };
    }
  },
);

const NavArrow = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  backgroundColor: 'rgba(15,48,64,0.80)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '50%',
  color: theme.vars.palette.text.secondary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: 'rgba(0,200,215,0.12)',
    borderColor: 'rgba(0,200,215,0.40)',
    color: theme.vars.palette.secondary.main,
  },
  '&.Mui-disabled': {
    opacity: 0.3,
    backgroundColor: 'transparent',
    borderColor: theme.vars.palette.divider,
  },
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
    border: `1px solid ${theme.vars.palette.divider}`,
  }),
}));

const DotRow = styled(Stack)({
  flexDirection: 'row',
  justifyContent: 'center',
  gap: 8,
  marginTop: 12,
});

const Dot = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isActive',
})<{ isActive: boolean }>(({ theme, isActive }) => ({
  width: isActive ? 18 : 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: isActive
    ? theme.vars.palette.secondary.main
    : 'rgba(255,255,255,0.18)',
  transition: `all ${DURATION.default}ms ${EASING.standard}`,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: isActive
      ? theme.vars.palette.secondary.main
      : 'rgba(255,255,255,0.35)',
  },
}));

const ActionRow = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  justifyContent: 'center',
  gap: theme.spacing(0.25),
  marginTop: theme.spacing(1.5),
  padding: theme.spacing(0.5, 1.5),
  borderRadius: 20,
  backgroundColor: 'rgba(11,39,49,0.70)',
  border: '1px solid rgba(255,255,255,0.10)',
  width: 'fit-content',
  alignSelf: 'center',
  ...theme.applyStyles('light', {
    backgroundColor: alpha(theme.palette.background.default, 0.8),
    border: `1px solid ${theme.vars.palette.divider}`,
  }),
}));

const ActionIcon = styled(IconButton)(({ theme }) => ({
  width: 32,
  height: 32,
  color: theme.vars.palette.text.secondary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    color: theme.vars.palette.text.primary,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
}));

const RemoveLink = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: alpha(theme.palette.error.main, 0.5),
  cursor: 'pointer',
  textAlign: 'center',
  marginTop: theme.spacing(1),
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    color: theme.vars.palette.error.main,
  },
}));

/* ── Helpers ── */

const getAmazonUrl = (marketplace: string, asin: string): string => {
  const mp = MARKETPLACE_OPTIONS.find((m) => m.value === marketplace);
  return `https://www.${mp?.domain ?? 'amazon.com'}/dp/${asin}`;
};

/* ── Component ── */

export const CollectedProductsSection = ({ nicheId }: CollectedProductsSectionProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const { data: collectedData, isLoading } = useGetCollectedProductsQuery(nicheId, {
    skip: !nicheId,
  });
  const [removeProduct] = useRemoveCollectedProductMutation();
  const [extractKeywords] = useExtractKeywordsMutation();
  const [saveTemplate] = useSaveListingTemplateMutation();

  const products = collectedData?.results ?? [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [slideDir, setSlideDir] = useState<'enter' | 'idle' | 'exit-left' | 'exit-right'>('idle');
  const slideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const safeIndex = products.length > 0 ? Math.min(currentIndex, products.length - 1) : 0;
  const currentProduct = products[safeIndex];

  // Reset slide direction after animation completes
  useEffect(() => {
    if (slideDir === 'enter') {
      slideTimerRef.current = setTimeout(() => setSlideDir('idle'), DURATION.default);
    }
    return () => clearTimeout(slideTimerRef.current);
  }, [slideDir]);

  const animateToIndex = useCallback(
    (newIndex: number, direction: 'left' | 'right') => {
      setSlideDir(direction === 'left' ? 'exit-left' : 'exit-right');
      setTimeout(() => {
        setCurrentIndex(newIndex);
        setSlideDir('enter');
      }, DURATION.default);
    },
    [],
  );

  const handlePrev = useCallback(() => {
    if (safeIndex > 0) animateToIndex(safeIndex - 1, 'right');
  }, [safeIndex, animateToIndex]);

  const handleNext = useCallback(() => {
    if (safeIndex < products.length - 1) animateToIndex(safeIndex + 1, 'left');
  }, [safeIndex, products.length, animateToIndex]);

  const handleDotClick = useCallback(
    (index: number) => {
      if (index === safeIndex) return;
      animateToIndex(index, index > safeIndex ? 'left' : 'right');
    },
    [safeIndex, animateToIndex],
  );

  const handleRemove = useCallback(
    async (collectedProductId: string) => {
      try {
        await removeProduct({ nicheId, collectedProductId }).unwrap();
        if (safeIndex > 0 && safeIndex >= products.length - 1) {
          setCurrentIndex(safeIndex - 1);
        }
      } catch {
        enqueueSnackbar(t('niches.drawer.collectedProducts.removeFailed'), {
          variant: 'error',
        });
      }
    },
    [removeProduct, nicheId, safeIndex, products.length, enqueueSnackbar, t],
  );

  const handleOpenDetail = useCallback((asin: string) => {
    window.open(`/amazon/research/product/${asin}`, '_blank');
  }, []);

  const handleOpenAmazon = useCallback((marketplace: string, asin: string) => {
    window.open(getAmazonUrl(marketplace, asin), '_blank', 'noopener');
  }, []);

  const handleExtractKeywords = useCallback(
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

  const handleSaveAsTemplate = useCallback(
    async (collectedProductId: string) => {
      try {
        await saveTemplate({ nicheId, collectedProductId }).unwrap();
        enqueueSnackbar(t('niches.drawer.collectedProducts.templateCreated'), {
          variant: 'success',
        });
      } catch {
        enqueueSnackbar(t('niches.drawer.collectedProducts.templateFailed'), {
          variant: 'error',
        });
      }
    },
    [saveTemplate, nicheId, enqueueSnackbar, t],
  );

  if (isLoading) {
    return (
      <Section>
        <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 2 }} />
      </Section>
    );
  }

  if (products.length === 0) return null;

  return (
    <Section>
      {/* Header */}
      <SectionHeader>
        <FavoriteIcon sx={{ fontSize: 15, color: 'error.main', opacity: 0.8 }} />
        <Typography variant="subtitle2" fontWeight={600}>
          {t('niches.drawer.collectedProducts.title')}
        </Typography>
        <CountBadge>{products.length}</CountBadge>
      </SectionHeader>

      {/* Carousel */}
      <CarouselContainer>
        <NavArrow
          size="small"
          onClick={handlePrev}
          disabled={safeIndex === 0}
          aria-label={t('niches.drawer.collectedProducts.previous')}
        >
          <ChevronLeftIcon sx={{ fontSize: 18 }} />
        </NavArrow>

        {currentProduct && (
          <CardSlide slideDir={slideDir}>
            <ProductCard
              product={currentProduct.product}
              onClick={() => handleOpenDetail(currentProduct.product.asin)}
              isFavorite
              disableHover
              hideHeart
            />
          </CardSlide>
        )}

        <NavArrow
          size="small"
          onClick={handleNext}
          disabled={safeIndex >= products.length - 1}
          aria-label={t('niches.drawer.collectedProducts.next')}
        >
          <ChevronRightIcon sx={{ fontSize: 18 }} />
        </NavArrow>
      </CarouselContainer>

      {/* Dot indicators */}
      {products.length > 1 && (
        <DotRow>
          {products.map((_, i) => (
            <Dot
              key={i}
              isActive={i === safeIndex}
              onClick={() => handleDotClick(i)}
              role="button"
              aria-label={`Product ${i + 1}`}
            />
          ))}
        </DotRow>
      )}

      {/* Action icons */}
      {currentProduct && (
        <Stack alignItems="center">
          <ActionRow>
            <Tooltip title={t('niches.drawer.collectedProducts.extractKeywords')} arrow>
              <ActionIcon
                onClick={() => handleExtractKeywords(currentProduct.id)}
                aria-label={t('niches.drawer.collectedProducts.extractKeywords')}
              >
                <AutoAwesomeIcon sx={{ fontSize: 17 }} />
              </ActionIcon>
            </Tooltip>
            <Tooltip title={t('niches.drawer.collectedProducts.useAsTemplate')} arrow>
              <ActionIcon
                onClick={() => handleSaveAsTemplate(currentProduct.id)}
                aria-label={t('niches.drawer.collectedProducts.useAsTemplate')}
              >
                <DescriptionOutlinedIcon sx={{ fontSize: 17 }} />
              </ActionIcon>
            </Tooltip>
            <Tooltip title={t('niches.drawer.collectedProducts.openDetail')} arrow>
              <ActionIcon
                onClick={() => handleOpenDetail(currentProduct.product.asin)}
                aria-label={t('niches.drawer.collectedProducts.openDetail')}
              >
                <ArrowForwardIcon sx={{ fontSize: 17 }} />
              </ActionIcon>
            </Tooltip>
            <Tooltip title={t('niches.drawer.collectedProducts.openAmazon')} arrow>
              <ActionIcon
                onClick={() =>
                  handleOpenAmazon(currentProduct.product.marketplace, currentProduct.product.asin)
                }
                aria-label={t('niches.drawer.collectedProducts.openAmazon')}
              >
                <OpenInNewIcon sx={{ fontSize: 17 }} />
              </ActionIcon>
            </Tooltip>
          </ActionRow>

          <Tooltip title={t('niches.drawer.collectedProducts.removeTooltip')}>
            <RemoveLink onClick={() => handleRemove(currentProduct.id)}>
              <DeleteOutlineIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.25 }} />
              {t('niches.drawer.collectedProducts.remove')}
            </RemoveLink>
          </Tooltip>
        </Stack>
      )}
    </Section>
  );
};
