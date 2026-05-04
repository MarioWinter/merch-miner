import { Box, ButtonBase, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { COLORS, DURATION } from '@/style/constants';
import type { DesignAsset } from '../../types';

interface ThumbnailItemProps {
  design: DesignAsset | undefined;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

interface ItemRootProps {
  active: boolean;
}

const ItemRoot = styled(ButtonBase, {
  shouldForwardProp: (prop) => prop !== 'active',
})<ItemRootProps>(({ theme, active }) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: active ? '100%' : 80,
  aspectRatio: '1 / 1',
  borderRadius: theme.shape.borderRadius,
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.background.default,
  border: active
    ? `2px solid ${COLORS.cyan}`
    : `1px solid ${theme.vars.palette.divider}`,
  opacity: active ? 1 : 0.6,
  transition: theme.transitions.create(['opacity', 'border-color', 'width'], {
    duration: DURATION.fast,
  }),
  '&:hover': {
    opacity: 1,
  },
  '&:focus-visible': {
    outline: `2px solid ${COLORS.cyan}`,
    outlineOffset: 2,
  },
}));

const ThumbImg = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  display: 'block',
});

const Placeholder = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  color: theme.vars.palette.text.disabled,
}));

const NumberBadge = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  left: theme.spacing(1),
  width: 24,
  height: 24,
  borderRadius: '50%',
  backgroundColor: alpha(COLORS.cyan, 0.85),
  color: COLORS.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: 600,
  lineHeight: 1,
}));

const ThumbnailItem = ({ design, index, isActive, onClick }: ThumbnailItemProps) => {
  const thumbnailUrl = design?.thumbnail_url || design?.file_url;

  return (
    <ItemRoot
      active={isActive}
      onClick={onClick}
      aria-label={`Design ${index + 1}`}
      aria-current={isActive ? 'true' : undefined}
    >
      {thumbnailUrl ? (
        <ThumbImg src={thumbnailUrl} alt={design?.file_name ?? `Design ${index + 1}`} />
      ) : (
        <Placeholder>
          <ImageOutlinedIcon sx={{ fontSize: 28 }} />
        </Placeholder>
      )}
      {isActive ? (
        <NumberBadge>
          <Typography component="span" variant="caption" sx={{ fontWeight: 600 }}>
            {index + 1}
          </Typography>
        </NumberBadge>
      ) : null}
    </ItemRoot>
  );
};

export default ThumbnailItem;
