import { Box, IconButton, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';

export const CanvasRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  backgroundColor: COLORS.artboardDark,
  backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
  backgroundSize: '24px 24px',
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.artboardLight,
    backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px)',
  }),
}));

export const BgPreviewOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 6px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

export const BgSwatchButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: 24,
  height: 24,
  borderRadius: 4,
  border: $active
    ? `2px solid ${theme.vars.palette.primary.main}`
    : '1px solid rgba(255, 255, 255, 0.15)',
  padding: 0,
  '&:hover': {
    borderColor: theme.vars.palette.primary.light,
  },
}));

export const BatchNavOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  left: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

export const CanvasToolbarOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 4,
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

export const ZoomOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 12,
  right: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '4px 8px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

export const DimensionOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 12,
  left: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  borderRadius: 8,
  backgroundColor: 'rgba(11, 39, 49, 0.85)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 255, 255, 0.10)',
  zIndex: 10,
  ...theme.applyStyles('light', {
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
  }),
}));

export const PreviewProgressBar = styled(LinearProgress)({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 20,
  height: 3,
});

export const ServerProcessingOverlay = styled(Box)({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 12,
  zIndex: 15,
  backgroundColor: 'rgba(0, 0, 0, 0.45)',
  backdropFilter: 'blur(2px)',
  animation: 'pulse-overlay 2s ease-in-out infinite',
  '@keyframes pulse-overlay': {
    '0%, 100%': { backgroundColor: 'rgba(0, 0, 0, 0.45)' },
    '50%': { backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  },
});

export const ToolButton = styled(IconButton, {
  shouldForwardProp: (p) => p !== '$active',
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: 32,
  height: 32,
  borderRadius: 6,
  color: $active ? theme.vars.palette.primary.main : theme.vars.palette.text.secondary,
  backgroundColor: $active ? 'rgba(255, 90, 79, 0.12)' : 'transparent',
  '&:hover': {
    backgroundColor: $active ? 'rgba(255, 90, 79, 0.18)' : 'rgba(255, 255, 255, 0.08)',
  },
}));

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5;
export const ZOOM_STEP = 0.1;

export type BgPreviewMode = 'transparent' | 'black' | 'white' | 'gray' | 'custom';

export const BG_PREVIEW_STYLES: Record<Exclude<BgPreviewMode, 'custom'>, { bg: string; pattern?: string; size?: string }> = {
  transparent: {
    bg: 'transparent',
    pattern: 'repeating-conic-gradient(rgba(128,128,128,0.15) 0% 25%, transparent 0% 50%)',
    size: '16px 16px',
  },
  black: { bg: '#000000' },
  white: { bg: '#FFFFFF' },
  gray: { bg: '#808080' },
};
