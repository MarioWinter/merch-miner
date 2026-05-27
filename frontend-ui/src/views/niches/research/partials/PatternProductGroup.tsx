import { Box, Collapse, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { useTranslation } from 'react-i18next';
import type { ResearchProduct } from '../types';
import { getPatternVisual, FALLBACK_VISUAL } from './patternConfig';
import { ProductAnalysisCard } from './ProductAnalysisCard';

interface PatternProductGroupProps {
  patternName: string;
  products: ResearchProduct[];
  nicheId: string;
  marketplace: string;
  expanded: boolean;
  onToggle: () => void;
}

const UNCATEGORIZED = 'Uncategorized';

const GroupContainer = styled(Box)({
  borderRadius: 12,
  overflow: 'hidden',
});

export const PatternProductGroup = ({
  patternName,
  products,
  nicheId,
  marketplace,
  expanded,
  onToggle,
}: PatternProductGroupProps) => {
  const { t } = useTranslation();

  const isUncategorized = patternName === UNCATEGORIZED;
  const visual = isUncategorized
    ? {
        ...FALLBACK_VISUAL,
        icon: HelpOutlineIcon,
        color: '#94A3B8',
        label: t('research.products.uncategorized'),
      }
    : getPatternVisual(patternName);

  const Icon = visual.icon;
  const color = visual.color;

  return (
    <GroupContainer
      sx={{
        background: alpha(color, 0.06),
        border: `1px solid ${alpha(color, 0.22)}`,
        borderLeft: `3px solid ${alpha(color, 0.5)}`,
      }}
    >
      {/* Clickable header */}
      <Box
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={expanded}
        aria-label={visual.label}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: '14px 18px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: alpha(color, 0.14),
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 17, color }} />
        </Box>

        <Typography
          variant="subtitle2"
          fontWeight={600}
          sx={{ letterSpacing: '0.02em', flex: 1 }}
        >
          {visual.label}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          {t('research.products.productCount', { count: products.length })}
        </Typography>

        <ExpandMoreIcon
          sx={{
            fontSize: 20,
            color: 'text.secondary',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 150ms ease',
          }}
        />
      </Box>

      {/* Collapsible body */}
      <Collapse in={expanded}>
        <Stack spacing={1.5} sx={{ p: '0 18px 18px' }}>
          {products.map((product) => (
            <ProductAnalysisCard
              key={product.asin}
              product={product}
              nicheId={nicheId}
              marketplace={marketplace}
            />
          ))}
        </Stack>
      </Collapse>
    </GroupContainer>
  );
};
