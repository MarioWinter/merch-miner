import { Rect } from 'react-konva';
import type { RubberBandRect } from '../types';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const FILL_COLOR = 'rgba(74, 158, 255, 0.08)';
const STROKE_COLOR = '#4A9EFF';
const STROKE_DASH = [4, 3];

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface RubberBandSelectionProps {
  rect: RubberBandRect | null;
  zoom: number;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const RubberBandSelection = ({ rect, zoom }: RubberBandSelectionProps) => {
  if (!rect) return null;

  // Normalize negative dimensions for rendering
  const x = rect.width < 0 ? rect.x + rect.width : rect.x;
  const y = rect.height < 0 ? rect.y + rect.height : rect.y;
  const w = Math.abs(rect.width);
  const h = Math.abs(rect.height);

  if (w < 2 && h < 2) return null;

  return (
    <Rect
      x={x}
      y={y}
      width={w}
      height={h}
      fill={FILL_COLOR}
      stroke={STROKE_COLOR}
      strokeWidth={1 / zoom}
      dash={STROKE_DASH}
      listening={false}
    />
  );
};

export default RubberBandSelection;
