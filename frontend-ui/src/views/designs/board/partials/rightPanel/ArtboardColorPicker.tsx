import { useCallback, useMemo, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import {
  Box,
  FormHelperText,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import { RgbaStringColorPicker } from 'react-colorful';
import { useTranslation } from 'react-i18next';
import { DURATION, EASING } from '@/style/constants';
import { parseColorToRgba } from '../../utils/parseColorToRgba';

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const HEX_REGEX = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;
const RGBA_PARTS_REGEX = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/;
const SHAKE_DURATION_MS = 320;

// Render the canonical rgba string as #RRGGBB or #RRGGBBAA so the hex
// input shows the current value as soon as the popover opens.
const rgbaToHex = (rgba: string): string => {
  const m = rgba.match(RGBA_PARTS_REGEX);
  if (!m) return '#FFFFFF';
  const [, r, g, b, a] = m;
  const toHex2 = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
  const base = `#${toHex2(Number(r))}${toHex2(Number(g))}${toHex2(Number(b))}`;
  const alpha = Number(a);
  if (!Number.isFinite(alpha) || alpha >= 0.999) return base;
  return `${base}${toHex2(Math.round(alpha * 255))}`;
};

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const shake = keyframes`
  0% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
  100% { transform: translateX(0); }
`;

const SwatchButton = styled('button', {
  shouldForwardProp: (p) => p !== 'rgbaColor',
})<{ rgbaColor: string }>(({ theme, rgbaColor }) => ({
  position: 'relative',
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${theme.vars.palette.divider}`,
  cursor: 'pointer',
  // CSS checker-pattern (8×8 squares) via conic-gradient — classic recipe.
  // Renders behind the color overlay so partial alpha is visually obvious.
  backgroundImage:
    'conic-gradient(#ccc 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75%)',
  backgroundSize: '8px 8px',
  backgroundColor: '#fff',
  overflow: 'hidden',
  '&:focus-visible': {
    outline: `2px solid ${theme.vars.palette.primary.main}`,
    outlineOffset: 2,
  },
  // Color overlay (the current rgba value) — sits on top of the checker.
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundColor: rgbaColor,
    pointerEvents: 'none',
  },
}));

const PopoverBody = styled(Box, {
  shouldForwardProp: (p) => p !== 'shaking',
})<{ shaking: boolean }>(({ theme, shaking }) => ({
  padding: theme.spacing(1.75, 1.75, 1.5),
  width: 256,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.25),
  animation: shaking ? `${shake} ${SHAKE_DURATION_MS}ms ${EASING.standard}` : 'none',
}));

// Top-of-popover preview row: bigger checker-backed swatch + canonical
// rgba string in monospace + alpha % badge. Gives the user a single
// glance summary of "what color am I editing right now".
const PreviewRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
}));

const PreviewSwatch = styled(Box, {
  shouldForwardProp: (p) => p !== 'rgbaColor',
})<{ rgbaColor: string }>(({ theme, rgbaColor }) => ({
  position: 'relative',
  width: 32,
  height: 32,
  flexShrink: 0,
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundImage:
    'conic-gradient(#ccc 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75%)',
  backgroundSize: '8px 8px',
  backgroundColor: '#fff',
  overflow: 'hidden',
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundColor: rgbaColor,
  },
}));

const PreviewValue = styled(Typography)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  fontFamily: 'monospace',
  fontSize: '0.6875rem',
  color: theme.vars.palette.text.secondary,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));

const AlphaBadge = styled(Typography)(({ theme }) => ({
  fontSize: '0.6875rem',
  fontWeight: 600,
  color: theme.vars.palette.text.primary,
  fontVariantNumeric: 'tabular-nums',
  padding: theme.spacing(0.25, 0.75),
  borderRadius: Number(theme.shape.borderRadius),
  backgroundColor: theme.vars.palette.action.hover,
  flexShrink: 0,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
}));

const PickerWrap = styled(Box)(({ theme }) => ({
  '& .react-colorful': {
    width: '100%',
    height: 160,
  },
  '& .react-colorful__saturation': {
    borderRadius: Number(theme.shape.borderRadius),
    border: `1px solid ${theme.vars.palette.divider}`,
  },
  '& .react-colorful__hue, & .react-colorful__alpha': {
    height: theme.spacing(1.5),
    marginTop: theme.spacing(1),
    borderRadius: theme.spacing(0.75),
  },
  '& .react-colorful__hue-pointer, & .react-colorful__alpha-pointer, & .react-colorful__saturation-pointer':
    {
      width: 14,
      height: 14,
      borderWidth: 2,
    },
}));

const Divider = styled(Box)(({ theme }) => ({
  height: 1,
  width: '100%',
  backgroundColor: theme.vars.palette.divider,
  opacity: 0.6,
}));

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const extractAlphaPercent = (rgba: string): number => {
  const m = rgba.match(RGBA_PARTS_REGEX);
  if (!m) return 100;
  const a = Number(m[4]);
  if (!Number.isFinite(a)) return 100;
  return Math.round(Math.max(0, Math.min(1, a)) * 100);
};

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

export interface ArtboardColorPickerProps {
  /** Persisted value — accepts hex (#RRGGBB), hex8 (#RRGGBBAA), or rgba(R,G,B,A). */
  value: string;
  /** Emits canonical `rgba(R, G, B, A)` on every change. */
  onChange: (rgba: string) => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardColorPicker = ({ value, onChange }: ArtboardColorPickerProps) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [shaking, setShaking] = useState(false);
  const [hexBuffer, setHexBuffer] = useState<string>('');
  const [hexError, setHexError] = useState(false);
  const shakeTimerRef = useRef<number | null>(null);
  const open = Boolean(anchorEl);

  // Canonical rgba derived from the prop. Re-parsed on each render so external
  // updates (e.g. preset apply) re-initialize the picker without an effect.
  const rgba = useMemo(() => parseColorToRgba(value), [value]);
  const alphaPercent = useMemo(() => extractAlphaPercent(rgba), [rgba]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
    }
    shakeTimerRef.current = window.setTimeout(() => {
      setShaking(false);
      shakeTimerRef.current = null;
    }, SHAKE_DURATION_MS);
  }, []);

  const handleSwatchClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      setAnchorEl(e.currentTarget);
      // Pre-fill the hex input with the current value so the user can
      // edit it directly instead of staring at an empty field.
      setHexBuffer(rgbaToHex(parseColorToRgba(value)));
      setHexError(false);
    },
    [value],
  );

  const handlePopoverClose = useCallback(() => {
    setAnchorEl(null);
    setHexBuffer('');
    setHexError(false);
  }, []);

  const handlePickerChange = useCallback(
    (next: string) => {
      // RgbaStringColorPicker always emits canonical rgba() — pass through.
      // Keep the hex input in sync with the picker so the user can read
      // off the live hex while dragging.
      setHexBuffer(rgbaToHex(next));
      if (hexError) setHexError(false);
      onChange(next);
    },
    [onChange, hexError],
  );

  const commitHex = useCallback(() => {
    const candidate = hexBuffer.trim();
    if (!candidate) {
      setHexError(false);
      return;
    }
    if (!HEX_REGEX.test(candidate)) {
      setHexError(true);
      triggerShake();
      return;
    }
    const next = parseColorToRgba(candidate);
    setHexError(false);
    setHexBuffer('');
    onChange(next);
  }, [hexBuffer, onChange, triggerShake]);

  const handleHexKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitHex();
      }
    },
    [commitHex],
  );

  return (
    <>
      <SwatchButton
        type="button"
        onClick={handleSwatchClick}
        rgbaColor={rgba}
        aria-label={t('design.panel.bgColor.label', 'Background color')}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-testid="ArtboardColorPicker-swatch"
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handlePopoverClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            // MUI's Popover slot type doesn't list arbitrary data-* attributes,
            // but the underlying Paper accepts them at runtime — cast through
            // a small Record so the test selector keeps working under tsc -b
            // strict.
            ...({ 'data-testid': 'ArtboardColorPicker-popover' } as Record<string, string>),
          },
        }}
      >
        <PopoverBody shaking={shaking}>
          {/* Preview row — large swatch + canonical rgba string + alpha badge */}
          <PreviewRow>
            <PreviewSwatch
              rgbaColor={rgba}
              data-testid="ArtboardColorPicker-preview"
            />
            <PreviewValue data-testid="ArtboardColorPicker-rgba-value">
              {rgba}
            </PreviewValue>
            <AlphaBadge data-testid="ArtboardColorPicker-alpha-badge">
              {t('design.panel.bgColor.alphaLabel', {
                defaultValue: 'Alpha: {{percent}}%',
                percent: alphaPercent,
              })}
            </AlphaBadge>
          </PreviewRow>

          <Divider />

          <PickerWrap>
            <RgbaStringColorPicker color={rgba} onChange={handlePickerChange} />
          </PickerWrap>

          <Divider />

          <TextField
            value={hexBuffer}
            onChange={(e) => {
              setHexBuffer(e.target.value);
              if (hexError) setHexError(false);
            }}
            onBlur={commitHex}
            onKeyDown={handleHexKeyDown}
            size="small"
            fullWidth
            placeholder="#RRGGBB or #RRGGBBAA"
            label={t('design.panel.bgColor.hexLabel', 'Hex')}
            error={hexError}
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: {
                maxLength: 9,
                'aria-label': t('design.panel.bgColor.hexLabel', 'Hex'),
                'data-testid': 'ArtboardColorPicker-hex-input',
                spellCheck: false,
                autoCapitalize: 'none',
                autoCorrect: 'off',
              },
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontFamily: 'monospace',
                letterSpacing: '0.04em',
              },
            }}
          />
          {hexError && (
            <FormHelperText error data-testid="ArtboardColorPicker-hex-error">
              {t('design.panel.bgColor.invalidHex', 'Invalid color value')}
            </FormHelperText>
          )}
        </PopoverBody>
      </Popover>
    </>
  );
};

export default ArtboardColorPicker;
