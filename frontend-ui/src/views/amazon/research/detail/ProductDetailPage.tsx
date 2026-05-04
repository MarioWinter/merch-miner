import { useCallback } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useRescrapeProductMutation,
  useUseAsTemplateMutation,
} from '../../../../store/researchSlice';
import { MARKETPLACE_OPTIONS } from '../types';
import useProductDetail from './hooks/useProductDetail';
import useAnalyzeDesign from '../hooks/useAnalyzeDesign';
import { getMainBsr } from '../utils/getMainBsr';
import KPIRow from './partials/KPIRow';
import ProductInfoSection from './partials/ProductInfoSection';
import PriceHistorySection from './partials/PriceHistorySection';
import KeywordsSection from './partials/KeywordsSection';
import CompetitionSection from './partials/CompetitionSection';

const getAmazonUrl = (marketplace: string, asin: string): string => {
  const mp = MARKETPLACE_OPTIONS.find((m) => m.value === marketplace);
  return `https://www.${mp?.domain ?? 'amazon.com'}/dp/${asin}`;
};

const ProductDetailPage = () => {
  const { asin } = useParams<{ asin: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [triggerUseAsTemplate, { isLoading: templateLoading }] =
    useUseAsTemplateMutation();
  const [triggerRescrape, { isLoading: rescrapeLoading }] =
    useRescrapeProductMutation();
  const { analyzeDesign, isAnalyzing, analyzingProductId } = useAnalyzeDesign();

  const {
    product,
    bsrHistory,
    similarProducts,
    sameBrandProducts,
    priceHistory,
    isLoading,
    is404,
  } = useProductDetail(asin ?? '');

  const handleBack = useCallback(() => {
    // Explicit target instead of navigate(-1): history is empty on direct
    // URL access / reload, and the previous entry could also be a Drawer
    // route rather than the research list. Same target as the breadcrumb.
    navigate('/amazon/research');
  }, [navigate]);

  const handleUseAsTemplate = useCallback(async () => {
    if (!asin) return;
    // TODO: get active niche from context/Redux when PROJ-11 integrates
    // For now, show warning. When niche is available:
    // await triggerUseAsTemplate({ asin, niche_id }).unwrap();
    void triggerUseAsTemplate;
    enqueueSnackbar(t('amazonResearch.detail.selectNicheFirst'), {
      variant: 'warning',
    });
  }, [asin, enqueueSnackbar, t, triggerUseAsTemplate]);

  const handleAnalyzeDesign = useCallback(() => {
    if (!product) return;
    analyzeDesign(product.id, product.thumbnail_url);
  }, [product, analyzeDesign]);

  const handleOpenAmazon = useCallback(() => {
    if (!product) return;
    window.open(
      getAmazonUrl(product.marketplace, product.asin),
      '_blank',
      'noopener',
    );
  }, [product]);

  const handleRescrape = useCallback(async () => {
    if (!product) return;
    try {
      await triggerRescrape({
        asin: product.asin,
        marketplace: product.marketplace,
      }).unwrap();
      enqueueSnackbar(t('amazonResearch.detail.rescrapeStarted'), {
        variant: 'info',
      });
    } catch {
      enqueueSnackbar(t('amazonResearch.detail.rescrapeError'), {
        variant: 'error',
      });
    }
  }, [product, triggerRescrape, enqueueSnackbar, t]);

  // 404 state (EC-16)
  if (is404) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          {t('amazonResearch.detail.notFound')}
        </Typography>
        <Typography variant="body2" color="text.disabled" sx={{ mb: 3 }}>
          {t('amazonResearch.detail.notFoundDescription', { asin })}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          {t('amazonResearch.detail.backToResearch')}
        </Button>
      </Box>
    );
  }

  // Loading skeleton
  if (isLoading || !product) {
    return (
      <Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton variant="text" width={200} />
        </Stack>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton
              key={i}
              variant="rectangular"
              height={100}
              sx={{ flex: 1, borderRadius: 2 }}
            />
          ))}
        </Stack>
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 2 }} />
      </Box>
    );
  }

  const bsrSnapshots = bsrHistory?.snapshots ?? [];
  const bsrSummary = bsrHistory?.summary ?? null;

  return (
    <Box>
      {/* Back + Breadcrumb (EC-24: direct URL navigation supported) */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton size="small" onClick={handleBack} aria-label="Go back">
          <ArrowBackIcon sx={{ fontSize: 20 }} />
        </IconButton>
        <Breadcrumbs>
          <Link
            component={RouterLink}
            to="/amazon/research"
            underline="hover"
            color="text.secondary"
            variant="body2"
          >
            {t('amazonResearch.detail.breadcrumb')}
          </Link>
          <Typography variant="body2" color="text.primary">
            {product.asin}
          </Typography>
        </Breadcrumbs>
      </Stack>

      {/* KPI Row */}
      <Box sx={{ mb: 3 }}>
        <KPIRow
          bsr={getMainBsr(product)}
          price={product.price}
          reviewsCount={product.reviews_count}
          rating={product.rating}
          bsrSummary={bsrSummary}
        />
      </Box>

      {/* Product Info + BSR Chart — action row sits in right column above BSR chart */}
      <Box sx={{ mb: 3 }}>
        <ProductInfoSection
          product={product}
          bsrSnapshots={bsrSnapshots}
          bsrSummary={bsrSummary}
          bsrCategories={product.bsr_categories}
          headerActions={
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              <Tooltip title={t('amazonResearch.detail.openInAmazon')}>
                <IconButton
                  size="medium"
                  color="secondary"
                  onClick={handleOpenAmazon}
                  aria-label={t('amazonResearch.detail.openInAmazon')}
                >
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('amazonResearch.detail.useAsTemplate')}>
                <span>
                  <IconButton
                    size="medium"
                    color="primary"
                    onClick={handleUseAsTemplate}
                    disabled={templateLoading}
                    aria-label={t('amazonResearch.detail.useAsTemplate')}
                  >
                    <ArticleIcon />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip
                title={
                  product.prompt_analysis
                    ? t('design.analyze.reused')
                    : t('design.analyze.button')
                }
              >
                <span>
                  <IconButton
                    size="medium"
                    color="secondary"
                    onClick={handleAnalyzeDesign}
                    disabled={isAnalyzing && analyzingProductId === product.id}
                    aria-label={t('design.analyze.button')}
                  >
                    {isAnalyzing && analyzingProductId === product.id ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : product.prompt_analysis ? (
                      <CheckCircleOutlineIcon />
                    ) : (
                      <BrushOutlinedIcon />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('amazonResearch.detail.rescrapeButton')}>
                <span>
                  <IconButton
                    size="medium"
                    color="secondary"
                    onClick={handleRescrape}
                    disabled={rescrapeLoading}
                    aria-label={t('amazonResearch.detail.rescrapeButton')}
                  >
                    {rescrapeLoading ? (
                      <CircularProgress size={20} color="inherit" />
                    ) : (
                      <RefreshIcon />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          }
        />
      </Box>

      {/* Keywords */}
      <Box sx={{ mb: 3 }}>
        <KeywordsSection keywords={product.meta_keywords ?? []} />
      </Box>

      {/* Price History */}
      <Box sx={{ mb: 3 }}>
        <PriceHistorySection snapshots={priceHistory} />
      </Box>

      {/* Competition */}
      <Box sx={{ mb: 3 }}>
        <CompetitionSection
          similarProducts={similarProducts}
          sameBrandProducts={sameBrandProducts}
        />
      </Box>
    </Box>
  );
};

export default ProductDetailPage;
