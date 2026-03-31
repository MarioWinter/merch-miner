import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

export const CanvasContainer = styled(Box)({
  width: '100%',
  flex: 1,
  minHeight: 0,
  position: 'relative',
  overflow: 'hidden',
  cursor: 'grab',
  '&:active': { cursor: 'grabbing' },
});

export const EmptyOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(2),
  zIndex: 5,
  color: theme.vars.palette.text.disabled,
  padding: theme.spacing(6),
  borderRadius: theme.shape.borderRadius * 3,
  border: `2px dashed ${theme.vars.palette.secondary.main}`,
  backgroundColor: 'rgba(0, 200, 215, 0.04)',
  pointerEvents: 'auto',
}));

export const AddCircle = styled(Box)(({ theme }) => ({
  width: 72,
  height: 72,
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `2px dashed ${theme.vars.palette.secondary.main}`,
  color: theme.vars.palette.secondary.main,
}));

export const DropZoneOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  inset: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  border: `3px dashed ${theme.vars.palette.secondary.main}`,
  borderRadius: theme.shape.borderRadius,
  backgroundColor: 'rgba(0, 200, 215, 0.08)',
}));

export const HiddenInput = styled('input')({
  display: 'none',
});
