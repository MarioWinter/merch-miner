import { Box, Card, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import BsrChartIcon from './BsrChartIcon';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import OpenInNewOutlinedIcon from '@mui/icons-material/OpenInNewOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import StarIcon from '@mui/icons-material/Star';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { MONO_FONT_STACK, SHADOW } from '../../../../style/constants';
import { HoverOverlay as SharedHoverOverlay, ActionPill, ProductImage as SharedProductImage } from '@/components/CardOverlay';
import { MARKETPLACE_OPTIONS, type AmazonProduct } from '../types';
import { getMainBsr } from '../utils/getMainBsr';
import { formatDaysOnline } from '../utils/formatDaysOnline';

interface ProductCardProps {
  product: AmazonProduct;
  onClick: () => void;
  onDoubleClick?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  hasSloganExtracted?: boolean;
  onExtractSlogan?: () => void;
  isExtracting?: boolean;
  disableHover?: boolean;
  hideHeart?: boolean;
  onAnalyzeDesign?: () => void;
  isAnalyzingDesign?: boolean;
  hasDesignAnalysis?: boolean;
}

const CARD_HEIGHT = 320;
const IMAGE_HEIGHT = 220;
const INFO_HEIGHT = 96;

const CARD_WIDTH = 215;

const StyledCard = styled(Card)(({ theme }) => ({
  width: CARD_WIDTH,
  height: CARD_HEIGHT,
  borderRadius: 12,
  cursor: 'pointer',
  border: `1px solid ${theme.vars.palette.divider}`,
  transition: 'transform 150ms ease, box-shadow 150ms ease',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
  flexShrink: 0,
  '&:hover': {
    transform: 'translateY(-2px)',
  },
}));

const ImageWrapper = styled(Box)({
  position: 'relative',
  height: IMAGE_HEIGHT,
  overflow: 'hidden',
});

// Shared components from CardOverlay — aliased for local use
const ProductImage = SharedProductImage;
const HoverOverlay = styled(SharedHoverOverlay)({
  '.MuiCard-root:hover &': { opacity: 1 },
});
const ActionBar = ActionPill;

const AiBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  width: 28,
  height: 28,
  backgroundColor: theme.vars.palette.secondary.dark,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const InfoArea = styled(Box)(({ theme }) => ({
  height: INFO_HEIGHT,
  padding: theme.spacing(0.75, 1),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  gap: 2,
}));

const getBsrThemeColor = (bsr: number | null): string => {
  if (bsr === null) return 'text.secondary';
  if (bsr < 10000) return 'success.main';
  if (bsr <= 50000) return 'warning.main';
  return 'text.secondary';
};

const getAmazonUrl = (marketplace: string, asin: string): string => {
  const mp = MARKETPLACE_OPTIONS.find((m) => m.value === marketplace);
  return `https://www.${mp?.domain ?? 'amazon.com'}/dp/${asin}`;
};

const renderStars = (rating: number | null) => {
  if (rating === null) return null;
  const filled = Math.round(rating);
  return (
    <Stack direction="row" spacing={0} alignItems="center">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          sx={{
            fontSize: 14,
            color: i <= filled ? 'warning.main' : 'text.disabled',
          }}
        />
      ))}
    </Stack>
  );
};

const ProductCard = ({
  product,
  onClick,
  onDoubleClick,
  isFavorite = false,
  onToggleFavorite,
  hasSloganExtracted = false,
  onExtractSlogan,
  isExtracting = false,
  disableHover = false,
  hideHeart = false,
  onAnalyzeDesign,
  isAnalyzingDesign = false,
  hasDesignAnalysis = false,
}: ProductCardProps) => {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  // Show the broadest/main category BSR (highest rank = first in Amazon DOM order)
  // After scraper fix, bsr_categories[0] is "Clothing, Shoes & Jewelry" (broadest)
  const mainBsr = getMainBsr(product);
  const bsrColor = getBsrThemeColor(mainBsr);

  const handleCopyAsin = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(product.asin).then(
      () => enqueueSnackbar('ASIN copied', { variant: 'success' }),
      () => enqueueSnackbar('Copy failed', { variant: 'error' }),
    );
  };

  const handleOpenAmazon = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(getAmazonUrl(product.marketplace, product.asin), '_blank', 'noopener');
  };

  const handleNavigateDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.();
  };

  const handleExtractSlogan = (e: React.MouseEvent) => {
    e.stopPropagation();
    onExtractSlogan?.();
  };

  const handleAnalyzeDesign = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAnalyzeDesign?.();
  };

  return (
    <StyledCard
      onClick={onClick}
      onDoubleClick={(e) => {
        e.preventDefault();
        onDoubleClick?.();
      }}
      elevation={0}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-label={`Product ${product.asin}`}
    >
      {/* Image area with hover overlay */}
      <ImageWrapper>
        <ProductImage
          src={product.thumbnail_url || '/placeholder-product.png'}
          alt={product.title}
          loading="lazy"
        />

        {/* Always-visible heart icon */}
        {!hideHeart && (
          <IconButton
            size="small"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
            sx={(theme) => ({
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 2,
              color: isFavorite
                ? theme.vars.palette.error.main
                : theme.vars.palette.text.secondary,
              backgroundColor: theme.vars.palette.background.paper,
              boxShadow: SHADOW.cardLight,
            })}
          >
            {isFavorite ? (
              <FavoriteIcon sx={{ fontSize: 14 }} />
            ) : (
              <FavoriteBorderIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        )}

        {!disableHover && (
          <HoverOverlay>
            <Box sx={{ height: 28 }} />

            <ActionBar>
              <Tooltip title="Copy ASIN">
                <IconButton size="small" onClick={handleCopyAsin} sx={{ color: 'text.primary' }}>
                  <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Open on Amazon">
                <IconButton size="small" onClick={handleOpenAmazon} sx={{ color: 'text.primary' }}>
                  <OpenInNewOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="View details">
                <IconButton size="small" onClick={handleNavigateDetail} sx={{ color: 'text.primary' }}>
                  <ArrowForwardOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              {onExtractSlogan && (
                <Tooltip title="Extract slogan">
                  <IconButton
                    size="small"
                    onClick={handleExtractSlogan}
                    disabled={isExtracting}
                    aria-label="Extract slogan"
                    sx={{ color: 'secondary.main' }}
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              )}
              {onAnalyzeDesign && (
                <Tooltip title={hasDesignAnalysis ? t('design.analyze.reused') : t('design.analyze.button')}>
                  <IconButton
                    size="small"
                    onClick={handleAnalyzeDesign}
                    disabled={isAnalyzingDesign}
                    aria-label={t('design.analyze.button')}
                    sx={{ color: hasDesignAnalysis ? 'success.main' : 'primary.main' }}
                  >
                    {isAnalyzingDesign ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <BrushOutlinedIcon sx={{ fontSize: 16 }} />
                    )}
                  </IconButton>
                </Tooltip>
              )}
            </ActionBar>
          </HoverOverlay>
        )}

        {hasSloganExtracted && (
          <AiBadge>
            <AutoAwesomeIcon sx={{ fontSize: 16, color: 'common.white' }} />
          </AiBadge>
        )}
      </ImageWrapper>

      {/* Info area: 3 dense rows like Flying Research */}
      <InfoArea>
        {/* Row 1: BSR + price */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ fontFeatureSettings: "'tnum'" }}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <BsrChartIcon sx={{ fontSize: 18, color: bsrColor }} />
            <Typography sx={{ fontWeight: 700, color: bsrColor, fontFamily: MONO_FONT_STACK, fontSize: '0.75rem' }}>
              {mainBsr !== null ? mainBsr.toLocaleString() : '–'}
            </Typography>
          </Stack>
          {product.price !== null && (
            <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: 'success.main' }}>
              ${Number(product.price).toFixed(2)}
            </Typography>
          )}
        </Stack>

        {/* Row 2: stars + reviews */}
        <Stack direction="row" alignItems="center" spacing={0.5}>
          {renderStars(product.rating)}
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            / {(product.reviews_count ?? 0).toLocaleString()} review{(product.reviews_count ?? 0) !== 1 ? 's' : ''}
          </Typography>
        </Stack>

        {/* Row 3: days online (left) + ASIN chip (right) */}
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          {product.listed_date ? (
            <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              {formatDaysOnline(product.listed_date)}
            </Typography>
          ) : (
            <span />
          )}
          <Chip
            label={product.asin}
            size="small"
            variant="outlined"
            onClick={handleCopyAsin}
            sx={{
              height: 18,
              fontFamily: MONO_FONT_STACK,
              '& .MuiChip-label': { px: 0.75, fontSize: '0.6rem' },
            }}
            aria-label={`Copy ASIN ${product.asin}`}
          />
        </Stack>
      </InfoArea>
    </StyledCard>
  );
};

export default ProductCard;
