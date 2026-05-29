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
const RGBA_ALPHA_REGEX = /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/;
const SHAKE_DURATION_MS = 320;

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
  padding: theme.spacing(1.5),
  width: 240,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  animation: shaking ? `${shake} ${SHAKE_DURATION_MS}ms ${EASING.standard}` : 'none',
}));

const PickerWrap = styled(Box)(({ theme }) => ({
  '& .react-colorful': {
    width: '100%',
    height: 180,
  },
  '& .react-colorful__saturation': {
    borderRadius: Number(theme.shape.borderRadius),
  },
  '& .react-colorful__hue, & .react-colorful__alpha': {
    height: theme.spacing(2),
    marginTop: theme.spacing(1),
    borderRadius: theme.spacing(1),
  },
}));

const AlphaLabel = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.text.secondary,
  fontVariantNumeric: 'tabular-nums',
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
}));

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

const extractAlphaPercent = (rgba: string): number => {
  const m = rgba.match(RGBA_ALPHA_REGEX);
  if (!m) return 100;
  const a = Number(m[1]);
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

  const handleSwatchClick = useCallback((e: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget);
    setHexBuffer('');
    setHexError(false);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setAnchorEl(null);
    setHexBuffer('');
    setHexError(false);
  }, []);

  const handlePickerChange = useCallback(
    (next: string) => {
      // RgbaStringColorPicker always emits canonical rgba() — pass through.
      // Clear any stale hex input + error when the picker drives the change.
      if (hexBuffer) setHexBuffer('');
      if (hexError) setHexError(false);
      onChange(next);
    },
    [onChange, hexBuffer, hexError],
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
        slotProps={{ paper: { 'data-testid': 'ArtboardColorPicker-popover' } }}
      >
        <PopoverBody shaking={shaking}>
          <PickerWrap>
            <RgbaStringColorPicker color={rgba} onChange={handlePickerChange} />
          </PickerWrap>
          <AlphaLabel variant="caption">
            {t('design.panel.bgColor.alphaLabel', {
              defaultValue: 'Alpha: {{percent}}%',
              percent: alphaPercent,
            })}
          </AlphaLabel>
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
              htmlInput: {
                maxLength: 9,
                'aria-label': t('design.panel.bgColor.hexLabel', 'Hex'),
                'data-testid': 'ArtboardColorPicker-hex-input',
                spellCheck: false,
                autoCapitalize: 'none',
                autoCorrect: 'off',
              },
            }}
            sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
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
