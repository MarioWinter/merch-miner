import { styled } from '@mui/material/styles';

/**
 * Shared product image — zoomed to show design detail.
 * Used in ProductCard (Research) and ProductThumbnailCard (Drawer).
 *
 * objectPosition x-axis nudged from 50% → 47% to compensate for the white
 * margin Amazon thumbnails carry on their right edge; without this the
 * 215px-wide card variant exposes a ~3px white sliver after the
 * transform:scale(1.6) crop. Sub-pixel rounding compounds the issue.
 */
const ProductImage = styled('img')(({ theme }) => ({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: '47% 30%',
  display: 'block',
  backgroundColor: theme.vars.palette.background.default,
  transform: 'scale(1.65)',
  transformOrigin: '50% 50%',
}));

export default ProductImage;
