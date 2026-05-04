import { useCallback, useMemo, useState } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import { HexColorPicker } from 'react-colorful';
import { useTranslation } from 'react-i18next';
import { DURATION, EASING } from '@/style/constants';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const DEFAULT_HEX = '#FFFFFF';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const shake = keyframes`
  0% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
  100% { transform: translateX(0); }
`;

const Root = styled(Box, {
  shouldForwardProp: (p) => p !== 'shaking',
})<{ shaking: boolean }>(({ shaking }) => ({
  display: 'flex',
  flexDirection: 'column',
  animation: shaking ? `${shake} 320ms ${EASING.standard}` : 'none',
}));

const PickerWrap = styled(Box)(({ theme }) => ({
  // react-colorful renders a 200x200 square by default; constrain with sx
  // overrides via CSS variables exposed by the library.
  '& .react-colorful': {
    width: '100%',
    maxWidth: 220,
    height: 180,
  },
  '& .react-colorful__saturation': {
    borderRadius: Number(theme.shape.borderRadius),
  },
  '& .react-colorful__hue': {
    height: theme.spacing(2),
    marginTop: theme.spacing(1),
    borderRadius: theme.spacing(1),
  },
}));

const InputRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

const Swatch = styled(Box, {
  shouldForwardProp: (p) => p !== 'color',
})<{ color: string }>(({ theme, color }) => ({
  width: theme.spacing(5),
  height: theme.spacing(5),
  borderRadius: Number(theme.shape.borderRadius),
  border: `1px solid ${theme.vars.palette.divider}`,
  backgroundColor: color,
  flexShrink: 0,
  transition: `background-color ${DURATION.fast}ms ${EASING.standard}`,
}));

const Hint = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.error.main,
  marginTop: theme.spacing(0.5),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalize a user-entered hex to the canonical `#RRGGBB` upper-case form.
 *  Accepts inputs with or without a leading `#`; uppercases letters so the
 *  backend + XLSX exports see consistent casing. Returns the input untouched
 *  if it doesn't match the length after normalization -- callers validate
 *  against the regex separately. */
const normalizeHex = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return withHash.toUpperCase();
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BackgroundColorPickerProps {
  /** Server value — `''` when unset. Must be `#RRGGBB` when non-empty. */
  value: string;
  /** Commit a validated `#RRGGBB` hex (or `''` to clear) to the backend. */
  onChange: (hex: string) => void | Promise<void>;
  disabled?: boolean;
  /** Rendered below the picker when disabled. */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Component — AC-125 (Displate Background Color)
//
// Combines `react-colorful`'s `HexColorPicker` with a hex text input + live
// swatch. Picker drags fire immediate PATCHes (normalized to `#RRGGBB` upper
// case); text input commits on blur/Enter with client-side regex validation
// + shake-on-invalid. Defence-in-depth: backend re-validates the same regex.
// ---------------------------------------------------------------------------

const BackgroundColorPicker = ({
  value,
  onChange,
  disabled = false,
  disabledReason,
}: BackgroundColorPickerProps) => {
  const { t } = useTranslation();

  // Local buffer so users can type partial hex (e.g. `#FF`) without the
  // field fighting the keystrokes. Synced from `value` via the "derived
  // state with last-seen sentinel" pattern -- React re-runs the update
  // during render when the server value changes, avoiding both the effect
  // lint rule and the extra render cycle that `useEffect` would cause.
  const [buffer, setBuffer] = useState(value || DEFAULT_HEX);
  const [lastSeenValue, setLastSeenValue] = useState(value);
  const [shaking, setShaking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  if (value !== lastSeenValue) {
    setLastSeenValue(value);
    setBuffer(value || DEFAULT_HEX);
    setHint(null);
  }

  const previewColor = useMemo(() => {
    if (HEX_REGEX.test(buffer)) return buffer;
    return value || DEFAULT_HEX;
  }, [buffer, value]);

  const triggerShake = useCallback(() => {
    setShaking(true);
    window.setTimeout(() => setShaking(false), 320);
  }, []);

  // Picker drag → commit immediately (values from react-colorful are always
  // valid `#rrggbb`; normalize to upper-case first).
  const handlePickerChange = useCallback(
    (next: string) => {
      const normalized = normalizeHex(next);
      setBuffer(normalized);
      setHint(null);
      if (HEX_REGEX.test(normalized) && normalized !== value) {
        void onChange(normalized);
      }
    },
    [onChange, value],
  );

  const commitBufferOrReject = useCallback(() => {
    const normalized = normalizeHex(buffer);
    setBuffer(normalized);
    if (!normalized) {
      // Empty = clear — allowed (AC-123 `blank=True`).
      setHint(null);
      if (value) void onChange('');
      return;
    }
    if (!HEX_REGEX.test(normalized)) {
      setHint(
        t('publish.edit.displate.bgColor.invalid', {
          defaultValue:
            'Enter a 6-digit hex color in the form #RRGGBB (e.g. #FF00AA).',
        }),
      );
      triggerShake();
      return;
    }
    setHint(null);
    if (normalized !== value) void onChange(normalized);
  }, [buffer, onChange, value, t, triggerShake]);

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitBufferOrReject();
      }
    },
    [commitBufferOrReject],
  );

  return (
    <Root shaking={shaking} data-testid="BackgroundColorPicker">
      <Typography variant="overline" color="text.secondary">
        {t('publish.edit.displate.bgColor.title', {
          defaultValue: 'Background Color',
        })}
      </Typography>

      <PickerWrap>
        <HexColorPicker
          color={HEX_REGEX.test(buffer) ? buffer : value || DEFAULT_HEX}
          onChange={handlePickerChange}
          // `react-colorful` doesn't expose a `disabled` prop -- overlay a
          // pointer-events:none wrapper when the component is disabled.
          style={disabled ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
        />
      </PickerWrap>

      <InputRow>
        <Swatch
          color={previewColor}
          role="img"
          aria-label={t('publish.edit.displate.bgColor.preview', {
            defaultValue: 'Background color preview: {{hex}}',
            hex: previewColor,
          })}
        />
        <TextField
          value={buffer}
          onChange={(e) => {
            setBuffer(e.target.value);
            if (hint) setHint(null);
          }}
          onBlur={commitBufferOrReject}
          onKeyDown={handleInputKeyDown}
          size="small"
          placeholder="#RRGGBB"
          inputProps={{
            maxLength: 7,
            'aria-label': t('publish.edit.displate.bgColor.hexInputLabel', {
              defaultValue: 'Background color hex',
            }),
            'data-testid': 'BackgroundColorPicker-input',
          }}
          disabled={disabled}
          error={Boolean(hint)}
          sx={{ flex: 1, maxWidth: 140, fontFamily: 'monospace' }}
        />
      </InputRow>

      {hint && <Hint variant="caption">{hint}</Hint>}

      {disabled && disabledReason && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
          {disabledReason}
        </Typography>
      )}
    </Root>
  );
};

export default BackgroundColorPicker;
