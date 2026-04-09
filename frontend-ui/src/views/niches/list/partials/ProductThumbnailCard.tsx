import { useState } from 'react';
import { Box, Checkbox, IconButton, Tooltip, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ── Types ─────────────────────────────────────────────────────────
interface ProductThumbnailCardProps {
  thumbnailUrl: string;
  title: string;
  bsr: number | null;
  price: number | null;
  selected: boolean;
  anySelected: boolean;
  onSelect: () => void;
  onKeywords: () => void;
  onSlogans: () => void;
  onCanvas: () => void;
  onDetail: () => void;
}

// ── BSR color helper ──────────────────────────────────────────────
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

// ── Styled Components ─────────────────────────────────────────────
const CardRoot = styled(Box, {
  shouldForwardProp: (p) => p !== 'isSelected',
})<{ isSelected: boolean }>(({ theme, isSelected }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${isSelected ? COLORS.cyan : theme.vars.palette.divider}`,
  backgroundColor: COLORS.inkElevated,
  overflow: 'hidden',
  transition: [
    `border-color ${DURATION.fast}ms ${EASING.standard}`,
    `box-shadow ${DURATION.fast}ms ${EASING.standard}`,
    `transform ${DURATION.fast}ms ${EASING.standard}`,
  ].join(', '),
  cursor: 'pointer',
  ...(isSelected && {
    boxShadow: `0 0 0 1px ${COLORS.cyan}`,
  }),
  '&:hover': {
    borderColor: alpha(COLORS.cyan, 0.3),
    transform: 'translateY(-1px)',
  },
  ...theme.applyStyles('light', {
    backgroundColor: theme.vars.palette.background.paper,
  }),
}));

const ImageWrapper = styled(Box)({
  position: 'relative',
  aspectRatio: '1 / 1',
  overflow: 'hidden',
  '& img': {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
});

const HoverOverlay = styled(Box, {
  shouldForwardProp: (p) => p !== 'visible',
})<{ visible: boolean }>(({ visible }) => ({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  backgroundColor: alpha(COLORS.ink, 0.7),
  backdropFilter: 'blur(4px)',
  opacity: visible ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.enter}`,
  pointerEvents: visible ? 'auto' : 'none',
}));

const OverlayButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== 'hoverColor',
})<{ hoverColor: string }>(({ theme, hoverColor }) => ({
  width: 32,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha('#fff', 0.1),
  color: theme.vars.palette.text.primary,
  transition: `all ${DURATION.fast}ms ${EASING.standard}`,
  '&:hover': {
    backgroundColor: alpha(hoverColor, 0.2),
    color: hoverColor,
  },
}));

const SelectCheckbox = styled(Checkbox, {
  shouldForwardProp: (p) => p !== 'showAlways',
})<{ showAlways: boolean }>(({ showAlways }) => ({
  position: 'absolute',
  top: 4,
  left: 4,
  zIndex: 2,
  padding: 2,
  opacity: showAlways ? 1 : 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  '.MuiSvgIcon-root': { fontSize: 20 },
}));

const InfoBar = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: `${theme.spacing(0.75)} ${theme.spacing(1)}`,
}));

// ── Component ─────────────────────────────────────────────────────
const ProductThumbnailCard = ({
  thumbnailUrl,
  title,
  bsr,
  price,
  selected,
  anySelected,
  onSelect,
  onKeywords,
  onSlogans,
  onCanvas,
  onDetail,
}: ProductThumbnailCardProps) => {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const color = bsrColor(bsr);

  return (
    <CardRoot
      isSelected={selected}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={{
        '&:hover .thumb-checkbox': { opacity: 1 },
      }}
    >
      <ImageWrapper>
        <SelectCheckbox
          className="thumb-checkbox"
          checked={selected}
          showAlways={anySelected || selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect();
          }}
          onClick={(e) => e.stopPropagation()}
          size="small"
          sx={{
            color: COLORS.snowDisabled,
            '&.Mui-checked': { color: COLORS.cyan },
          }}
          inputProps={{ 'aria-label': title }}
        />
        <img src={thumbnailUrl} alt={title} loading="lazy" />
        <HoverOverlay visible={hovered && !selected}>
          <Tooltip title={t('niches.drawer.collectedProducts.sendToKeywords')} arrow>
            <OverlayButton
              hoverColor={COLORS.warningDk}
              onClick={(e) => { e.stopPropagation(); onKeywords(); }}
              aria-label={t('niches.drawer.collectedProducts.sendToKeywords')}
              size="small"
            >
              <VpnKeyIcon sx={{ fontSize: 16 }} />
            </OverlayButton>
          </Tooltip>
          <Tooltip title={t('niches.drawer.collectedProducts.sendToSlogans')} arrow>
            <OverlayButton
              hoverColor={COLORS.cyan}
              onClick={(e) => { e.stopPropagation(); onSlogans(); }}
              aria-label={t('niches.drawer.collectedProducts.sendToSlogans')}
              size="small"
            >
              <LightbulbOutlinedIcon sx={{ fontSize: 16 }} />
            </OverlayButton>
          </Tooltip>
          <Tooltip title={t('niches.drawer.collectedProducts.sendToDesign')} arrow>
            <OverlayButton
              hoverColor={COLORS.red}
              onClick={(e) => { e.stopPropagation(); onCanvas(); }}
              aria-label={t('niches.drawer.collectedProducts.sendToDesign')}
              size="small"
            >
              <BrushOutlinedIcon sx={{ fontSize: 16 }} />
            </OverlayButton>
          </Tooltip>
          <Tooltip title={t('niches.drawer.collectedProducts.viewDetail')} arrow>
            <OverlayButton
              hoverColor={COLORS.snow}
              onClick={(e) => { e.stopPropagation(); onDetail(); }}
              aria-label={t('niches.drawer.collectedProducts.viewDetail')}
              size="small"
            >
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </OverlayButton>
          </Tooltip>
        </HoverOverlay>
      </ImageWrapper>

      <InfoBar>
        <Typography
          variant="caption"
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color }}
        >
          <TrendingUpIcon sx={{ fontSize: 14, color }} />
          {formatBsr(bsr)}
        </Typography>
        <Typography variant="caption" fontWeight={600}>
          {price != null ? `$${price.toFixed(2)}` : '-'}
        </Typography>
      </InfoBar>
    </CardRoot>
  );
};

export default ProductThumbnailCard;
