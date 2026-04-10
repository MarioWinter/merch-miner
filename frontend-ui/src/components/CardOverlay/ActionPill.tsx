import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { SHADOW } from '@/style/constants';

/**
 * Shared action pill — centered row of icon buttons inside a card overlay.
 * Rounded pill shape with paper background + shadow.
 * Used in ProductCard (Research) and ProductThumbnailCard (Drawer).
 */
const ActionPill = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(0.5),
  backgroundColor: theme.vars.palette.background.paper,
  borderRadius: 20,
  padding: theme.spacing(0.5, 1.5),
  boxShadow: SHADOW.card,
  alignSelf: 'center',
  width: 'fit-content',
  ...theme.applyStyles('light', {
    boxShadow: SHADOW.cardLightMode,
  }),
}));

export default ActionPill;
