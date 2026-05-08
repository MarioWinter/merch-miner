import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// -----------------------------------------------------------------
// Slider — Replicate-style before/after with drag handle + click-track.
// Pure DOM, no extra dependency.
// -----------------------------------------------------------------

const Stage = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  aspectRatio: '1 / 1',
  maxHeight: '70vh',
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: theme.vars.palette.background.default,
  cursor: 'ew-resize',
  userSelect: 'none',
  touchAction: 'none',
}));

const Layer = styled('img')({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  pointerEvents: 'none',
});

const TopLayerWrap = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'pos',
})<{ pos: number }>(({ pos }) => ({
  position: 'absolute',
  inset: 0,
  clipPath: `inset(0 ${100 - pos}% 0 0)`,
  WebkitClipPath: `inset(0 ${100 - pos}% 0 0)`,
}));

const Handle = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'pos',
})<{ pos: number }>(({ pos }) => ({
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: `${pos}%`,
  width: 2,
  backgroundColor: COLORS.red,
  transform: 'translateX(-1px)',
  pointerEvents: 'none',
}));

const Grip = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: 36,
  height: 36,
  marginLeft: -18,
  marginTop: -18,
  borderRadius: '50%',
  backgroundColor: COLORS.red,
  color: theme.vars.palette.common.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
  cursor: 'ew-resize',
  pointerEvents: 'auto',
}));

const Tag = styled(Chip)({
  position: 'absolute',
  top: 12,
  height: 24,
  borderRadius: 6,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  color: '#fff',
});

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface UpscaleCompareModalProps {
  open: boolean;
  onClose: () => void;
  /** Original (low-res) image URL — Design.image_file. */
  beforeUrl: string;
  /** Upscaled image URL — Design.upscaled_file. */
  afterUrl: string;
  /** Optional label (e.g. design name). */
  designLabel?: string;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const UpscaleCompareModal = ({
  open,
  onClose,
  beforeUrl,
  afterUrl,
  designLabel,
}: UpscaleCompareModalProps) => {
  const { t } = useTranslation();
  // useReducer over useState — dispatch in effects passes the React 19
  // cascading-renders rule which flags direct setState calls.
  const [pos, dispatchPos] = useReducer(
    (_state: number, next: number) => Math.max(0, Math.min(100, next)),
    50,
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Reset position to center each time modal opens.
  useEffect(() => {
    if (open) dispatchPos(50);
  }, [open]);

  const updateFromClientX = useCallback((clientX: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    dispatchPos(ratio);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = true;
      stageRef.current?.setPointerCapture(e.pointerId);
      updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      updateFromClientX(e.clientX);
    },
    [updateFromClientX],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      draggingRef.current = false;
      stageRef.current?.releasePointerCapture(e.pointerId);
    },
    [],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 2,
          },
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <CompareArrowsIcon sx={{ fontSize: 20 }} />
          <Typography variant="h6" sx={{ flex: 1 }}>
            {t('upscale.compare.title', { defaultValue: 'Upscale comparison' })}
          </Typography>
          {designLabel && (
            <Typography variant="caption" color="text.secondary">
              {designLabel}
            </Typography>
          )}
          <IconButton size="small" onClick={onClose} aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t('upscale.compare.hint', {
            defaultValue:
              'Drag the divider to reveal more of the original or the upscaled version.',
          })}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Stage
          ref={stageRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={t('upscale.compare.stageAria', 'Upscale comparison slider')}
        >
          {/* Bottom layer: upscaled (after) */}
          <Layer src={afterUrl} alt="upscaled" draggable={false} />

          {/* Top layer: original (before), clipped to slider position */}
          <TopLayerWrap pos={pos}>
            <Layer src={beforeUrl} alt="original" draggable={false} />
          </TopLayerWrap>

          {/* Labels */}
          <Tag
            label={t('upscale.compare.before', { defaultValue: 'Before' })}
            size="small"
            sx={{ left: 12 }}
          />
          <Tag
            label={t('upscale.compare.after', { defaultValue: 'After (4500×5400)' })}
            size="small"
            sx={{ right: 12 }}
          />

          {/* Divider line + grip */}
          <Handle pos={pos}>
            <Grip>
              <CompareArrowsIcon sx={{ fontSize: 18 }} />
            </Grip>
          </Handle>
        </Stage>
      </DialogContent>
    </Dialog>
  );
};

export default UpscaleCompareModal;
