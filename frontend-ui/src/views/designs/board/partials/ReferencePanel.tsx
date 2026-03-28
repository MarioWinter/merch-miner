import { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ImageSearchIcon from '@mui/icons-material/ImageSearch';
import { useTranslation } from 'react-i18next';
import type { ReferenceProduct } from '../types';

interface ReferencePanelProps {
  products: ReferenceProduct[];
  isLoading: boolean;
  onAnalyzeImage: (imageUrl: string) => void;
  onSelectPrompt: (prompt: string) => void;
}

const ProductCard = styled(Box)(({ theme }) => ({
  border: `1px solid ${alpha('#fff', 0.08)}`,
  borderRadius: 8,
  padding: theme.spacing(1.5),
  cursor: 'pointer',
  transition: 'border-color 150ms ease',
  '&:hover': {
    borderColor: alpha('#fff', 0.14),
  },
  ...theme.applyStyles('light', {
    border: `1px solid ${alpha('#071E26', 0.08)}`,
    '&:hover': {
      borderColor: alpha('#071E26', 0.14),
    },
  }),
}));

const ProductImage = styled('img')({
  width: '100%',
  height: 120,
  objectFit: 'contain',
  borderRadius: 4,
  backgroundColor: 'rgba(0,0,0,0.1)',
});

export const ReferencePanel = ({
  products,
  isLoading,
  onAnalyzeImage,
  onSelectPrompt,
}: ReferencePanelProps) => {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Stack spacing={1.5}>
        <Typography variant="h6">{t('design.board.references')}</Typography>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
        ))}
      </Stack>
    );
  }

  if (products.length === 0) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <Typography variant="body2" color="text.disabled">
          {t('design.board.noReferences')}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">{t('design.board.references')}</Typography>
      {products.map((product) => {
        const isExpanded = expandedId === product.product_id;
        return (
          <ProductCard
            key={product.product_id}
            onClick={() =>
              setExpandedId(isExpanded ? null : product.product_id)
            }
          >
            {product.image && (
              <ProductImage
                src={product.image}
                alt={product.title}
                loading="lazy"
              />
            )}
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }} noWrap>
              {product.title}
            </Typography>

            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }} useFlexGap>
              {product.visual_style && (
                <Chip label={product.visual_style} size="small" sx={{ fontSize: '0.6875rem' }} />
              )}
              {product.tone && (
                <Chip label={product.tone} size="small" variant="outlined" sx={{ fontSize: '0.6875rem' }} />
              )}
            </Stack>

            {isExpanded && (
              <Box sx={{ mt: 1 }}>
                {product.graphic_elements && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('research.products.graphicElements')}: {product.graphic_elements}
                  </Typography>
                )}
                {product.vibe && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {t('research.products.vibe')}: {Array.isArray(product.vibe) ? product.vibe.join(', ') : product.vibe}
                  </Typography>
                )}
                {Boolean(product.prompt_analysis?.final_prompt) && (
                  <Tooltip title={t('design.board.useThisPrompt')}>
                    <Chip
                      label={t('design.board.usePrompt')}
                      size="small"
                      color="primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectPrompt(
                          String(product.prompt_analysis?.final_prompt ?? ''),
                        );
                      }}
                      sx={{ mt: 0.5 }}
                    />
                  </Tooltip>
                )}
              </Box>
            )}

            <Box sx={{ mt: 0.5, display: 'flex', justifyContent: 'flex-end' }}>
              <Tooltip title={t('design.analyze.button')}>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (product.image) onAnalyzeImage(product.image);
                  }}
                  disabled={!product.image}
                  color="secondary"
                  aria-label={t('design.analyze.button')}
                >
                  <ImageSearchIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </ProductCard>
        );
      })}
    </Stack>
  );
};
