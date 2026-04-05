import { Line } from 'react-konva';
import type { SnapGuide } from '../hooks/useSnapGuides';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

/** Cyan guide color from design system secondary */
const GUIDE_COLOR = '#00C8D7';
const GUIDE_STROKE_WIDTH = 1;
const GUIDE_DASH = [4, 3];

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface SnapGuidesProps {
  guides: SnapGuide[];
  artboardWidth: number;
  artboardHeight: number;
  zoom: number;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const SnapGuides = ({
  guides,
  artboardWidth,
  artboardHeight,
  zoom,
}: SnapGuidesProps) => {
  if (guides.length === 0) return null;

  const strokeWidth = GUIDE_STROKE_WIDTH / Math.max(zoom, 0.3);

  return (
    <>
      {guides.map((guide, i) => {
        if (guide.type === 'v') {
          // Vertical line at x = guide.pos, spanning full artboard height
          return (
            <Line
              key={`snap-v-${i}`}
              points={[guide.pos, 0, guide.pos, artboardHeight]}
              stroke={GUIDE_COLOR}
              strokeWidth={strokeWidth}
              dash={GUIDE_DASH}
              listening={false}
            />
          );
        }
        // Horizontal line at y = guide.pos, spanning full artboard width
        return (
          <Line
            key={`snap-h-${i}`}
            points={[0, guide.pos, artboardWidth, guide.pos]}
            stroke={GUIDE_COLOR}
            strokeWidth={strokeWidth}
            dash={GUIDE_DASH}
            listening={false}
          />
        );
      })}
    </>
  );
};

export default SnapGuides;
