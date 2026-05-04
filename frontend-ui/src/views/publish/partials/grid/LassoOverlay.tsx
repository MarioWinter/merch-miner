import { Box } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { COLORS } from '@/style/constants';

interface LassoOverlayProps {
  rect: { x: number; y: number; width: number; height: number } | null;
}

const LassoRect = styled(Box)({
  position: 'absolute',
  border: `1.5px dashed ${COLORS.cyan}`,
  backgroundColor: alpha(COLORS.cyan, 0.06),
  borderRadius: 4,
  pointerEvents: 'none',
  zIndex: 10,
});

const LassoOverlay = ({ rect }: LassoOverlayProps) => {
  if (!rect || rect.width < 4 || rect.height < 4) return null;

  return (
    <LassoRect
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
};

export default LassoOverlay;
