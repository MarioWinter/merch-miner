import { Arrow } from 'react-konva';
import { COLORS } from '@/style/constants';
import type { ArtboardData } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const ARROW_COLOR_DARK = COLORS.snowMuted; // text.secondary dark
const ARROW_COLOR_LIGHT = COLORS.mist; // text.secondary light
const ARROW_STROKE_WIDTH = 1;
const ARROW_POINTER_LENGTH = 6;
const ARROW_POINTER_WIDTH = 5;

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

/**
 * Compute anchor points: right-center of source, left-center of target.
 */
const getEdgePoints = (
  source: ArtboardData,
  target: ArtboardData,
): [number, number, number, number] => {
  const sx = source.x + source.width;
  const sy = source.y + source.height / 2;
  const tx = target.x;
  const ty = target.y + target.height / 2;
  return [sx, sy, tx, ty];
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ConnectionArrowProps {
  source: ArtboardData;
  target: ArtboardData;
  isDark: boolean;
  zoom: number;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ConnectionArrow = ({ source, target, isDark, zoom }: ConnectionArrowProps) => {
  const [sx, sy, tx, ty] = getEdgePoints(source, target);
  const color = isDark ? ARROW_COLOR_DARK : ARROW_COLOR_LIGHT;

  return (
    <Arrow
      points={[sx, sy, tx, ty]}
      stroke={color}
      strokeWidth={ARROW_STROKE_WIDTH / zoom}
      pointerLength={ARROW_POINTER_LENGTH / zoom}
      pointerWidth={ARROW_POINTER_WIDTH / zoom}
      fill={color}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
};

export default ConnectionArrow;
