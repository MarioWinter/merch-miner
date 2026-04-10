import { styled } from '@mui/material/styles';

/**
 * Shared product image — zoomed to show design detail.
 * Used in ProductCard (Research) and ProductThumbnailCard (Drawer).
 */
const ProductImage = styled('img')(({ theme }) => ({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center 30%',
  display: 'block',
  backgroundColor: theme.vars.palette.background.default,
  transform: 'scale(1.6)',
}));

export default ProductImage;
