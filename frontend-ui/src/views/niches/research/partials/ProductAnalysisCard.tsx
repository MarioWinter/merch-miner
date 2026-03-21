import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlockIcon from '@mui/icons-material/Block';
import { useTranslation } from 'react-i18next';
import { getPatternVisual } from './patternConfig';
import { useDispatch, useSelector } from 'react-redux';
import { useSnackbar } from 'notistack';
import { MONO_FONT_STACK } from '@/style/constants';
import { COLORS } from '@/style/constants';
import { toggleSlogan, selectCollectedSlogans } from '@/store/collectedItemsSlice';
import type { RootState } from '@/store';
import type { ResearchProduct } from '../types';

interface ProductAnalysisCardProps {
  product: ResearchProduct;
  nicheId: string;
}

const Card = styled(Box)(({ theme }) => ({
  background: theme.vars.palette.background.paper,
  border: `1px solid ${theme.vars.palette.divider}`,
  borderRadius: 12,
  overflow: 'hidden',
  transition: 'box-shadow 150ms ease',
  '&:hover': {
    boxShadow: `0 4px 16px rgba(0,0,0,0.30)`,
  },
}));

const ProductHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(2),
  padding: theme.spacing(2, 2.5),
}));

const Thumbnail = styled('img')({
  width: 64,
  height: 64,
  borderRadius: 8,
  objectFit: 'cover',
  flexShrink: 0,
  backgroundColor: 'rgba(255,255,255,0.04)',
});

const AsinText = styled(Typography)({
  fontFamily: MONO_FONT_STACK,
  fontSize: '0.75rem',
});

const SectionLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: theme.vars.palette.text.secondary,
  marginBottom: theme.spacing(0.5),
}));

const DetailSection = styled(Box)(({ theme }) => ({
  padding: theme.spacing(0, 2.5, 2),
}));

const FieldRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(0.5),
}));

const FieldLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  fontWeight: 600,
  color: theme.vars.palette.text.secondary,
  minWidth: 100,
  flexShrink: 0,
}));

const FieldValue = styled(Typography)({
  fontSize: '0.8125rem',
});

export const ProductAnalysisCard = ({ product, nicheId }: ProductAnalysisCardProps) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const [expanded, setExpanded] = useState(false);
  const vision = product.vision_analysis;
  const emotional = product.emotional_analysis;
  const collectedSlogans = useSelector((state: RootState) => selectCollectedSlogans(state, nicheId));

  const handleSloganClick = (sloganText: string) => {
    dispatch(toggleSlogan({ nicheId, value: sloganText }));
    navigator.clipboard.writeText(sloganText);
    enqueueSnackbar(t('research.products.slogan') + ': ' + sloganText, { variant: 'success' });
  };

  return (
    <Card>
      <ProductHeader>
        {product.thumbnail_url && (
          <Thumbnail
            src={product.thumbnail_url}
            alt={product.title}
            loading="lazy"
          />
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} noWrap>
            {product.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <AsinText color="text.secondary">{product.asin}</AsinText>
            {product.brand && (
              <Typography variant="caption" color="text.secondary">
                {product.brand}
              </Typography>
            )}
            {product.brand_blocked && (
              <Chip
                icon={<BlockIcon sx={{ fontSize: 12 }} />}
                label={t('research.products.trademark')}
                size="small"
                sx={(theme) => ({
                  height: 20,
                  fontSize: '0.6875rem',
                  backgroundColor: alpha(theme.palette.warning.main, 0.12),
                  color: theme.vars.palette.warning.main,
                  borderRadius: '4px',
                  '& .MuiChip-icon': {
                    color: 'inherit',
                  },
                })}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Rating
              value={product.rating}
              precision={0.1}
              size="small"
              readOnly
            />
            <Typography variant="caption" color="text.secondary">
              {t('research.products.reviews', { count: product.reviews_count })}
            </Typography>
          </Stack>
        </Box>
        <IconButton
          size="small"
          onClick={() => setExpanded((prev) => !prev)}
          sx={{
            alignSelf: 'flex-start',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ExpandMoreIcon sx={{ fontSize: 20 }} />
        </IconButton>
      </ProductHeader>

      {/* Compact summary chips */}
      {(vision || emotional) && (
        <Box sx={{ px: 2.5, pb: 1.5 }}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {vision?.slogan_text && (() => {
              const isCollected = collectedSlogans.includes(vision.slogan_text);
              return (
                <Chip
                  icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                  label={vision.slogan_text}
                  size="small"
                  onClick={() => handleSloganClick(vision.slogan_text)}
                  sx={(theme) => ({
                    backgroundColor: isCollected
                      ? alpha(COLORS.cyan, 0.2)
                      : alpha(theme.palette.secondary.main, 0.1),
                    color: isCollected ? COLORS.cyan : theme.vars.palette.secondary.main,
                    border: isCollected ? `1px solid ${COLORS.cyan}` : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  })}
                />
              );
            })()}
            {emotional?.emotional_pattern && (() => {
              const visual = getPatternVisual(emotional.emotional_pattern);
              const PatternIcon = visual.icon;
              return (
                <Chip
                  icon={<PatternIcon sx={{ fontSize: 14 }} />}
                  label={emotional.emotional_pattern}
                  size="small"
                  sx={{
                    backgroundColor: alpha(visual.color, 0.12),
                    color: visual.color,
                    borderRadius: '6px',
                  }}
                />
              );
            })()}
          </Stack>
        </Box>
      )}

      <Collapse in={expanded}>
        <DetailSection>
          <Stack spacing={2}>
            {/* Vision Analysis */}
            {vision && (
              <Box>
                <SectionLabel>{t('research.products.vision')}</SectionLabel>
                <Stack spacing={0.25}>
                  <FieldRow>
                    <FieldLabel>{t('research.products.slogan')}</FieldLabel>
                    <FieldValue>{vision.slogan_text}</FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.meaning')}</FieldLabel>
                    <FieldValue color="text.secondary">{vision.meaning_context}</FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.visualStyle')}</FieldLabel>
                    <FieldValue color="text.secondary">{vision.visual_style}</FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.graphicElements')}</FieldLabel>
                    <FieldValue color="text.secondary">{vision.graphic_elements}</FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.layout')}</FieldLabel>
                    <FieldValue color="text.secondary">{vision.layout_composition}</FieldValue>
                  </FieldRow>
                </Stack>
              </Box>
            )}

            {/* Emotional Analysis */}
            {emotional && (
              <Box>
                <SectionLabel>{t('research.products.emotional')}</SectionLabel>
                <Stack spacing={0.25}>
                  <FieldRow>
                    <FieldLabel>{t('research.products.pattern')}</FieldLabel>
                    <FieldValue>{emotional.emotional_pattern}</FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.tone')}</FieldLabel>
                    <FieldValue color="text.secondary">{emotional.tone}</FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.vibe')}</FieldLabel>
                    <FieldValue color="text.secondary">
                      {emotional.vibe.energy_level} / {emotional.vibe.attitude} / {emotional.vibe.core_emotion}
                    </FieldValue>
                  </FieldRow>
                </Stack>

                {/* Psychology */}
                <SectionLabel sx={{ mt: 1.5 }}>{t('research.products.psychology')}</SectionLabel>
                <Stack spacing={0.25}>
                  <FieldRow>
                    <FieldLabel>{t('research.products.buyerProfile')}</FieldLabel>
                    <FieldValue color="text.secondary">
                      {emotional.customer_psychology.buyer_profile}
                    </FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.emotionalNeed')}</FieldLabel>
                    <FieldValue color="text.secondary">
                      {emotional.customer_psychology.emotional_need}
                    </FieldValue>
                  </FieldRow>
                  <FieldRow>
                    <FieldLabel>{t('research.products.internalMonologue')}</FieldLabel>
                    <FieldValue color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      {emotional.customer_psychology.internal_monologue}
                    </FieldValue>
                  </FieldRow>
                </Stack>

                {/* Adaptation */}
                <SectionLabel sx={{ mt: 1.5 }}>{t('research.products.adaptation')}</SectionLabel>
                <Typography variant="body2" color="text.secondary">
                  {emotional.adaptation_formula}
                </Typography>
                {emotional.adaptation_examples.length > 0 && (
                  <Box sx={{ mt: 0.5 }}>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {emotional.adaptation_examples.map((ex, i) => (
                        <Chip key={i} label={ex} size="small" variant="outlined" sx={{ borderRadius: '6px' }} />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}
          </Stack>
        </DetailSection>
      </Collapse>
    </Card>
  );
};
