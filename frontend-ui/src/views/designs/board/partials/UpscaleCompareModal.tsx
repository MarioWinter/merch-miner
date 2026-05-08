import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

const NavButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'side',
})<{ side: 'left' | 'right' }>(({ side }) => ({
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  zIndex: 1,
  width: 40,
  height: 40,
  backgroundColor: 'rgba(0, 0, 0, 0.65)',
  color: '#fff',
  ...(side === 'left' ? { left: 8 } : { right: 8 }),
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  '&.Mui-disabled': {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    color: 'rgba(255, 255, 255, 0.4)',
  },
}));

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface UpscaleCompareItem {
  /** Original (low-res) image URL — Design.image_file. */
  beforeUrl: string;
  /** Upscaled image URL — Design.upscaled_file. */
  afterUrl: string;
  /** Optional label (design name, slogan, ASIN). */
  label?: string;
}

interface UpscaleCompareModalProps {
  open: boolean;
  onClose: () => void;
  /** One or more comparison items. Use a single-element array for single-mode. */
  items: UpscaleCompareItem[];
  /** Optional initial index into `items` (defaults to 0). */
  initialIndex?: number;
}

// -----------------------------------------------------------------
// Reducer — current carousel index + slider position kept atomic so
// React 19 cascading-renders rule passes (dispatch in effects allowed).
// -----------------------------------------------------------------

interface State {
  index: number;
  pos: number;
}

type Action =
  | { type: 'RESET'; index: number }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'SET_POS'; pos: number };

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'RESET':
      return { index: action.index, pos: 50 };
    case 'NEXT':
      return { ...state, pos: 50, index: state.index + 1 };
    case 'PREV':
      return { ...state, pos: 50, index: state.index - 1 };
    case 'SET_POS':
      return { ...state, pos: Math.max(0, Math.min(100, action.pos)) };
    default:
      return state;
  }
};

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const UpscaleCompareModal = ({
  open,
  onClose,
  items,
  initialIndex = 0,
}: UpscaleCompareModalProps) => {
  const { t } = useTranslation();
  const [{ index, pos }, dispatch] = useReducer(reducer, {
    index: initialIndex,
    pos: 50,
  });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  // Reset to requested initial index every time modal opens.
  useEffect(() => {
    if (open) {
      const safeIndex = Math.max(0, Math.min(initialIndex, items.length - 1));
      dispatch({ type: 'RESET', index: safeIndex });
    }
  }, [open, initialIndex, items.length]);

  // Keyboard arrows for carousel navigation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && index < items.length - 1) {
        dispatch({ type: 'NEXT' });
      } else if (e.key === 'ArrowLeft' && index > 0) {
        dispatch({ type: 'PREV' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, items.length]);

  const updateFromClientX = useCallback((clientX: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    dispatch({ type: 'SET_POS', pos: ratio });
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

  if (items.length === 0) return null;
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  const current = items[safeIndex];
  const total = items.length;
  const showCarousel = total > 1;

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
          {current.label && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 220 }}>
              {current.label}
            </Typography>
          )}
          {showCarousel && (
            <Chip
              label={t('upscale.compare.counter', {
                defaultValue: '{{current}} / {{total}}',
                current: safeIndex + 1,
                total,
              })}
              size="small"
              sx={{ height: 22, fontSize: 11 }}
            />
          )}
          <IconButton size="small" onClick={onClose} aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {showCarousel
            ? t('upscale.compare.hintCarousel', {
                defaultValue:
                  'Drag the divider to compare. Use ← / → or the arrow buttons to step through designs.',
              })
            : t('upscale.compare.hint', {
                defaultValue:
                  'Drag the divider to reveal more of the original or the upscaled version.',
              })}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ position: 'relative' }}>
          <Stage
            ref={stageRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            aria-label={t('upscale.compare.stageAria', 'Upscale comparison slider')}
          >
            {/* Bottom layer: upscaled (after) */}
            <Layer
              key={`after-${safeIndex}`}
              src={current.afterUrl}
              alt="upscaled"
              draggable={false}
            />

            {/* Top layer: original (before), clipped to slider position */}
            <TopLayerWrap pos={pos}>
              <Layer
                key={`before-${safeIndex}`}
                src={current.beforeUrl}
                alt="original"
                draggable={false}
              />
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

          {/* Carousel nav — only shown when >1 item */}
          {showCarousel && (
            <>
              <Tooltip
                title={t('upscale.compare.prev', { defaultValue: 'Previous' })}
              >
                <span>
                  <NavButton
                    side="left"
                    onClick={() => dispatch({ type: 'PREV' })}
                    disabled={safeIndex === 0}
                    aria-label={t('upscale.compare.prev', 'Previous')}
                  >
                    <ChevronLeftIcon />
                  </NavButton>
                </span>
              </Tooltip>
              <Tooltip
                title={t('upscale.compare.next', { defaultValue: 'Next' })}
              >
                <span>
                  <NavButton
                    side="right"
                    onClick={() => dispatch({ type: 'NEXT' })}
                    disabled={safeIndex === total - 1}
                    aria-label={t('upscale.compare.next', 'Next')}
                  >
                    <ChevronRightIcon />
                  </NavButton>
                </span>
              </Tooltip>
            </>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default UpscaleCompareModal;
