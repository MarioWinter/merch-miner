import { useState } from 'react';
import {
  Box,
  Checkbox,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING, SHADOW } from '@/style/constants';
import { HoverOverlay, ActionPill, ProductImage } from '@/components/CardOverlay';

// ── Types ─────────────────────────────────────────────────────────
interface ProductThumbnailCardProps {
  thumbnailUrl: string;
  title: string;
  bsr: number | null;
  price: number | null;
  selected: boolean;
  anySelected: boolean;
  hasImage?: boolean;
  onSelect: () => void;
  onKeywords: () => void;
  onSlogans: () => void;
  onCanvas: () => void;
  onDetail: () => void;
  onRemove: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────
const bsrColor = (bsr: number | null): string => {
  if (bsr == null) return COLORS.snowDisabled;
  if (bsr < 10_000) return COLORS.successDk;
  if (bsr < 50_000) return COLORS.warningDk;
  return COLORS.snowDisabled;
};

const formatBsr = (bsr: number | null): string => {
  if (bsr == null) return '-';
  if (bsr >= 1_000_000) return `${(bsr / 1_000_000).toFixed(1)}M`;
  if (bsr >= 1_000) return `${(bsr / 1_000).toFixed(0)}k`;
  return String(bsr);
};

// ── Styled ────────────────────────────────────────────────────────
const CardRoot = styled(Box, {
  shouldForwardProp: (p) => p !== 'isSelected',
})<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  position: 'relative',
  borderRadius: 12,
  border: `1px solid ${isSelected ? COLORS.cyan : theme.vars.palette.divider}`,
  overflow: 'hidden',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  transition: 'transform 150ms ease, box-shadow 150ms ease',
  ...(isSelected && { boxShadow: `0 0 0 1px ${COLORS.cyan}` }),
  '&:hover': { transform: 'translateY(-2px)' },
  '&:hover .hover-overlay': { opacity: 1 },
  '&:hover .thumb-checkbox': { opacity: 1 },
}));

const ImageWrapper = styled(Box)({
  position: 'relative',
  overflow: 'hidden',
  aspectRatio: '4 / 5',
});

const SelectCheckbox = styled(Checkbox, {
  shouldForwardProp: (p) => p !== 'showAlways',
})<{ showAlways: boolean }>(({ theme, showAlways }) => ({
  position: 'absolute',
  top: 8,
  left: 8,
  zIndex: 2,
  padding: 4,
  opacity: showAlways ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  backgroundColor: theme.vars.palette.background.paper,
  borderRadius: 6,
  boxShadow: SHADOW.card,
  '.MuiSvgIcon-root': { fontSize: 18 },
  '&:hover': { backgroundColor: theme.vars.palette.background.paper },
}));

const InfoBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1, 1.25),
}));

// ── Component ─────────────────────────────────────────────────────
const ProductThumbnailCard = ({
  thumbnailUrl,
  title,
  bsr,
  price,
  selected,
  anySelected,
  hasImage = true,
  onSelect,
  onKeywords,
  onSlogans,
  onCanvas,
  onDetail,
  onRemove,
}: ProductThumbnailCardProps) => {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const color = bsrColor(bsr);

  const handleMenuAction = (action: () => void) => {
    setMenuAnchor(null);
    action();
  };

  return (
    <CardRoot isSelected={selected} onClick={onDetail}>
      <ImageWrapper>
        <SelectCheckbox
          className="thumb-checkbox"
          checked={selected}
          showAlways={anySelected || selected}
          onChange={(e) => { e.stopPropagation(); onSelect(); }}
          onClick={(e) => e.stopPropagation()}
          size="small"
          sx={{ color: COLORS.snow, '&.Mui-checked': { color: COLORS.cyan } }}
          inputProps={{ 'aria-label': title }}
        />

        <ProductImage src={thumbnailUrl} alt={title} loading="lazy" />

        <HoverOverlay className="hover-overlay">
          <Box sx={{ height: 28 }} />
          <ActionPill>
            <Tooltip title={t('niches.drawer.collectedProducts.sendToKeywords', 'Keywords')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onKeywords(); }}
                sx={{ color: 'text.primary' }}
              >
                <SearchIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('niches.drawer.collectedProducts.sendToSlogans', 'Slogans')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onSlogans(); }}
                sx={{ color: 'text.primary' }}
              >
                <FormatQuoteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('niches.drawer.collectedProducts.viewDetail', 'Detail')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); onDetail(); }}
                sx={{ color: 'text.primary' }}
              >
                <OpenInNewIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title={t('common.more', 'More')}>
              <IconButton
                size="small"
                onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); }}
                sx={{ color: 'text.primary' }}
              >
                <MoreHorizIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </ActionPill>
        </HoverOverlay>
      </ImageWrapper>

      <InfoBar>
        <Typography
          variant="caption"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color, fontWeight: 600 }}
        >
          <TrendingUpIcon sx={{ fontSize: 14, color }} />
          {formatBsr(bsr)}
        </Typography>
        <Typography variant="caption" fontWeight={700} sx={{ color: COLORS.successDk }}>
          {price != null ? `$${Number(price).toFixed(2)}` : '-'}
        </Typography>
      </InfoBar>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onClick={(e) => e.stopPropagation()}
        slotProps={{
          paper: {
            sx: {
              backgroundColor: COLORS.inkElevated,
              border: '1px solid',
              borderColor: 'divider',
              minWidth: 180,
            },
          },
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {hasImage && (
          <MenuItem onClick={() => handleMenuAction(onCanvas)} dense>
            <ListItemIcon><PaletteOutlinedIcon sx={{ fontSize: 16, color: COLORS.red }} /></ListItemIcon>
            <ListItemText>{t('niches.drawer.collectedProducts.sendToDesign', 'Send to Canvas')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => handleMenuAction(onRemove)} dense>
          <ListItemIcon><DeleteOutlineIcon sx={{ fontSize: 16, color: COLORS.errorDk }} /></ListItemIcon>
          <ListItemText>{t('niches.drawer.collectedProducts.remove', 'Remove')}</ListItemText>
        </MenuItem>
      </Menu>
    </CardRoot>
  );
};

export default ProductThumbnailCard;
