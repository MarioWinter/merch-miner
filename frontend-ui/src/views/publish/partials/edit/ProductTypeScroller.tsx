import { useCallback } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import CheckroomOutlinedIcon from '@mui/icons-material/CheckroomOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { MBA_PRODUCT_TYPES } from '../../types';
import SectionHeader from './SectionHeader';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const Scroller = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1.25),
  overflowX: 'auto',
  paddingBlock: theme.spacing(0.5),
  paddingInline: theme.spacing(0.25),
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': {
    height: 3,
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: theme.vars.palette.divider,
    borderRadius: 3,
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: alpha(COLORS.cyan, 0.5),
  },
}));

const ProductCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'selected',
})<{ selected: boolean }>(({ theme, selected }) => ({
  position: 'relative',
  flex: '0 0 auto',
  width: 72,
  minHeight: 88,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(0.75),
  padding: theme.spacing(1, 0.75),
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${
    selected ? COLORS.cyan : theme.vars.palette.divider
  }`,
  backgroundColor: selected ? alpha(COLORS.cyan, 0.06) : 'transparent',
  color: selected ? COLORS.cyan : theme.vars.palette.text.secondary,
  cursor: 'pointer',
  transition: `border-color ${DURATION.fast}ms ${EASING.standard}, background-color ${DURATION.fast}ms ${EASING.standard}, color ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.45),
  },
  '&:focus-visible': {
    outline: `2px solid ${alpha(COLORS.cyan, 0.6)}`,
    outlineOffset: 2,
  },
}));

const CardLabel = styled(Typography)({
  lineHeight: 1.2,
  textAlign: 'center',
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
});

const CountBadge = styled(Box)({
  position: 'absolute',
  top: 4,
  right: 4,
  minWidth: 18,
  height: 18,
  paddingInline: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 9999,
  backgroundColor: COLORS.cyan,
  color: COLORS.white,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1,
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProductTypeScrollerProps {
  selected: string[];
  onChange: (types: string[]) => void;
  onOptionsClick: (context: string) => void;
}

const ProductTypeScroller = ({
  selected,
  onChange,
  onOptionsClick,
}: ProductTypeScrollerProps) => {
  const { t } = useTranslation();

  const toggle = useCallback(
    (key: string) => {
      if (selected.includes(key)) {
        onChange(selected.filter((k) => k !== key));
      } else {
        onChange([...selected, key]);
      }
    },
    [selected, onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, key: string) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggle(key);
      }
    },
    [toggle],
  );

  return (
    <Stack component="section" gap={0.5}>
      <SectionHeader
        title={t('publish.edit.products.title')}
        count={selected.length}
        context="products"
        onOptionsClick={onOptionsClick}
      />
      <Scroller role="group" aria-label={t('publish.edit.products.title')}>
        {MBA_PRODUCT_TYPES.map((pt) => {
          const isSelected = selected.includes(pt.key);
          return (
            <ProductCard
              key={pt.key}
              selected={isSelected}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={t('publish.edit.products.productType', {
                label: pt.label,
              })}
              tabIndex={0}
              onClick={() => toggle(pt.key)}
              onKeyDown={(e) => handleKeyDown(e, pt.key)}
            >
              <CheckroomOutlinedIcon sx={{ fontSize: 40 }} />
              <CardLabel variant="caption">{pt.label}</CardLabel>
              {isSelected && <CountBadge>1</CountBadge>}
            </ProductCard>
          );
        })}
      </Scroller>
    </Stack>
  );
};

export default ProductTypeScroller;
