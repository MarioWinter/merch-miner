import { Box } from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';

// -----------------------------------------------------------------
// Animation
// -----------------------------------------------------------------

// Soft pulse sweeping across the artboard — avoids replacing the image so the
// user keeps visual context while an upscale runs.
const shimmer = keyframes`
  0%   { opacity: 0.0; transform: translateX(-100%); }
  50%  { opacity: 1.0; transform: translateX(0%); }
  100% { opacity: 0.0; transform: translateX(100%); }
`;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const OverlayRoot = styled(Box)({
  position: 'absolute',
  pointerEvents: 'none',
  overflow: 'hidden',
  zIndex: 25,
});

const ShimmerBand = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  background: `linear-gradient(120deg, transparent 0%, color-mix(in srgb, ${theme.vars.palette.primary.main} 12%, transparent) 50%, transparent 100%)`,
  animation: `${shimmer} 1500ms ease-in-out infinite`,
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

export interface ArtboardShimmerOverlayProps {
  /** Screen-space top-left coordinate of the artboard (px). */
  x: number;
  y: number;
  /** Screen-space size of the artboard (px). */
  width: number;
  height: number;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardShimmerOverlay = ({ x, y, width, height }: ArtboardShimmerOverlayProps) => (
  <OverlayRoot
    aria-hidden
    data-testid="artboard-shimmer-overlay"
    sx={{ left: x, top: y, width, height }}
  >
    <ShimmerBand />
  </OverlayRoot>
);

export default ArtboardShimmerOverlay;
