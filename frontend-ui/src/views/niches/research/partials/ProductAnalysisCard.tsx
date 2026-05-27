import { useMemo, useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import VisibilityIcon from '@mui/icons-material/Visibility';
import BlockIcon from '@mui/icons-material/Block';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import { getPatternVisual } from './patternConfig';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import { useCreateIdeaMutation, useListIdeasQuery } from '@/store/ideaSlice';
import NicheCollectionHeartButton from '@/components/NicheCollectionHeartButton';
import type { ResearchProduct } from '../types';
import {
  Card,
  ProductHeader,
  ThumbnailWrap,
  Thumbnail,
  ThumbnailPreview,
  HeaderLabel,
  AsinText,
  SectionLabel,
  DetailSection,
  FieldRow,
  FieldLabel,
  FieldValue,
} from './ProductAnalysisCard.styles';

interface ProductAnalysisCardProps {
  product: ResearchProduct;
  nicheId: string;
  marketplace: string;
}

export const ProductAnalysisCard = ({ product, nicheId, marketplace }: ProductAnalysisCardProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const vision = product.vision_analysis;
  const emotional = product.emotional_analysis;

  // Source of truth for "is this slogan already in the niche pipeline" is the
  // backend ideas list — not the local Redux toggle slice. Saving a slogan
  // creates a manual Idea (backend defaults is_manual=true) which then shows
  // up in the drawer's Collected Slogans card.
  const { data: ideasData } = useListIdeasQuery(
    { nicheId, page_size: 200 },
    { skip: !nicheId },
  );
  const collectedSlogans = useMemo(
    () => new Set((ideasData?.results ?? []).map((i) => i.slogan_text)),
    [ideasData],
  );
  const [createIdea] = useCreateIdeaMutation();

  // Backend's create-idea view splits slogan_text on \n and creates one
  // idea per non-empty line (supports newline-separated bulk paste). The
  // AI vision-analysis sometimes emits multiline strings, which would
  // shred a single chip click into 4+ fragmented ideas. Collapse all
  // whitespace runs (including newlines) into single spaces so one click
  // = one idea.
  const normalizeSlogan = (s: string) => s.replace(/\s+/g, ' ').trim();

  const handleSloganClick = async (sloganText: string) => {
    const clean = normalizeSlogan(sloganText);
    if (!clean) return;
    if (collectedSlogans.has(clean)) {
      enqueueSnackbar(
        t('research.products.sloganAlreadyCollected', { slogan: clean }),
        { variant: 'info' },
      );
      return;
    }
    try {
      await createIdea({ nicheId, body: { slogan_text: clean } }).unwrap();
      enqueueSnackbar(
        t('research.products.sloganAdded', { slogan: clean }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(t('research.products.sloganAddFailed'), { variant: 'error' });
    }
  };

  return (
    <Card>
      <ProductHeader>
        {product.thumbnail_url && (
          <>
            <ThumbnailWrap
              onMouseEnter={() => setShowPreview(true)}
              onMouseLeave={() => setShowPreview(false)}
            >
              <Thumbnail
                src={product.thumbnail_url}
                alt={product.title}
                loading="lazy"
              />
            </ThumbnailWrap>
            {showPreview && (
              <ThumbnailPreview>
                <img src={product.thumbnail_url} alt={product.title} />
              </ThumbnailPreview>
            )}
          </>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <HeaderLabel color="text.disabled">
            {t('research.products.titleLabel')}
          </HeaderLabel>
          <Typography variant="subtitle2" fontWeight={600} noWrap>
            {product.title}
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
            <Box>
              <HeaderLabel color="text.disabled">ASIN</HeaderLabel>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AsinText color="text.secondary">{product.asin}</AsinText>
                {product.url && (
                  <IconButton
                    component="a"
                    href={product.url}
                    target="_blank"
                    rel="noopener"
                    size="small"
                    sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'secondary.main' } }}
                    aria-label="Open on Amazon"
                  >
                    <OpenInNewIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                )}
              </Stack>
            </Box>
            {product.brand && (
              <Box>
                <HeaderLabel color="text.disabled">
                  {t('research.products.brandLabel')}
                </HeaderLabel>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {product.brand}
                  </Typography>
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
                        '& .MuiChip-icon': { color: 'inherit' },
                      })}
                    />
                  )}
                </Stack>
              </Box>
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
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ alignSelf: 'flex-start' }}
        >
          <NicheCollectionHeartButton
            nicheId={nicheId || null}
            asin={product.asin}
            marketplace={marketplace}
          />
          <IconButton
            size="small"
            onClick={() => setExpanded((prev) => !prev)}
            sx={{
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <ExpandMoreIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Stack>
      </ProductHeader>

      {/* Compact summary chips */}
      {(vision || emotional) && (
        <Box sx={{ px: 2.5, pb: 1.5 }}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
            {vision?.slogan_text && (() => {
              const isCollected = collectedSlogans.has(normalizeSlogan(vision.slogan_text));
              return (
                <Chip
                  icon={<VisibilityIcon sx={{ fontSize: 14 }} />}
                  label={vision.slogan_text}
                  size="small"
                  onClick={() => handleSloganClick(vision.slogan_text)}
                  sx={(theme) => ({
                    display: 'flex',
                    maxWidth: '100%',
                    height: 'auto',
                    backgroundColor: isCollected
                      ? alpha(COLORS.cyan, 0.2)
                      : alpha(theme.palette.secondary.main, 0.1),
                    color: isCollected ? COLORS.cyan : theme.vars.palette.secondary.main,
                    border: isCollected ? `1px solid ${COLORS.cyan}` : '1px solid transparent',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    '& .MuiChip-label': { whiteSpace: 'normal', wordBreak: 'break-word' },
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
                    '& .MuiChip-icon': { color: 'inherit' },
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
