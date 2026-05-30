/**
 * FIX chat — animated border overlay rendered around the ChatInputBar Shell
 * while an assistant response is streaming.
 *
 * Why a sibling-overlay (not Shell `::before`):
 *   - Three previous attempts on `fix/chat-bugfixes-and-grouping` broke the
 *     contenteditable typing path. Wrapping Shell in a container that needed
 *     `overflow: hidden` / `clip-path` removed the caret from the editable.
 *   - A pseudo-element on Shell would also force us to give Shell a
 *     `z-index` stacking context, which changes how the @-mention picker /
 *     command palette overlays compose against the input.
 *
 * The fix here: render this Box as the *last* absolute-positioned child of
 * Shell. Shell only needs `position: relative` (no overflow / clip changes).
 * `pointer-events: none` keeps the contenteditable unscathed; the conic
 * gradient is painted in via CSS `mask` so only the 1-px ring is visible.
 */
import { Box } from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import { DURATION } from '@/style/constants';

interface StreamingBorderProps {
  /** Whether the assistant message is currently streaming. */
  active: boolean;
}

/** Slow rotation of the conic-gradient — primary.light hot-spot moves around
 *  the border. 6s feels "thinking" rather than "loading". */
const rotate = keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

const Overlay = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active: boolean }>(({ theme, active }) => ({
  position: 'absolute',
  // Sit 1px outside the Shell on every edge so the ring sits *on* the
  // existing 1-px divider border instead of inside the padding box.
  inset: -1,
  pointerEvents: 'none',
  // Match the Shell's outer radius (kept in sync via the +1 for the -1 inset).
  borderRadius: 23,
  opacity: active ? 1 : 0,
  transition: `opacity ${DURATION.default}ms ease`,
  overflow: 'hidden',
  // Prevent the overlay from forming its own stacking context unless active.
  // Without this, the mention-picker / command-palette positioning could
  // shift even when the border is invisible.
  zIndex: active ? 1 : -1,

  // The rotating conic-gradient lives on a ::before that fills the overlay
  // (rotated about its center). The mask trick on the parent confines the
  // visible paint to a 1-px ring at the radius.
  '&::before': {
    content: '""',
    position: 'absolute',
    inset: '-50%',
    background: `conic-gradient(from 0deg, transparent 0%, ${theme.vars.palette.primary.light} 25%, transparent 50%, ${theme.vars.palette.primary.light} 75%, transparent 100%)`,
    // Only animate while active — `animationPlayState` lets the same node
    // pause without re-attaching the keyframe on every render.
    animation: active ? `${rotate} 6s linear infinite` : 'none',
  },

  // Mask = ring-only. The opaque-on-content-box minus opaque-on-padding-box
  // subtraction leaves a 1-px frame; the conic gradient bleeds through it.
  // `mask-composite: exclude` is the modern syntax (Safari 15.4+, Chrome 120+).
  mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  maskComposite: 'exclude',
  WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
  WebkitMaskComposite: 'xor',
  padding: 1,

  // Respect prefers-reduced-motion — drop the spin, keep a static glow.
  '@media (prefers-reduced-motion: reduce)': {
    '&::before': {
      animation: 'none',
    },
  },
}));

const StreamingBorder = ({ active }: StreamingBorderProps) => (
  <Overlay
    data-testid="chat-input-streaming-border"
    data-active={active ? 'true' : 'false'}
    aria-hidden="true"
    active={active}
  />
);

export default StreamingBorder;
