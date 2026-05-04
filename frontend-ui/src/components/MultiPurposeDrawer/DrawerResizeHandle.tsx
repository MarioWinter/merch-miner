import { Box } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';

interface DrawerResizeHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void;
}

const HandleRoot = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  width: 6,
  height: '100%',
  cursor: 'col-resize',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:hover, &:active': {
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
  '&:hover .handle-bar': {
    backgroundColor: theme.vars.palette.primary.main,
    opacity: 0.8,
  },
}));

const HandleBar = styled(Box)(({ theme }) => ({
  width: 2,
  height: 32,
  borderRadius: 1,
  backgroundColor: theme.vars.palette.divider,
  opacity: 0.6,
  transition: 'background-color 120ms ease, opacity 120ms ease',
}));

const DrawerResizeHandle = ({ onPointerDown, onPointerMove, onPointerUp }: DrawerResizeHandleProps) => (
  <HandleRoot
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={onPointerUp}
    onPointerCancel={onPointerUp}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize drawer"
  >
    <HandleBar className="handle-bar" />
  </HandleRoot>
);

export default DrawerResizeHandle;
