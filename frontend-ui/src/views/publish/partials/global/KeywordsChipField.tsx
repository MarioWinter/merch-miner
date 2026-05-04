import { useCallback, useMemo, useState } from 'react';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import { keyframes, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { LISTING_CHAR_LIMITS, type ListingLanguage } from '../../types';

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

const FieldRoot = styled(Box, {
  shouldForwardProp: (p) => p !== 'shaking',
})<{ shaking: boolean }>(({ shaking }) => ({
  display: 'flex',
  flexDirection: 'column',
  animation: shaking ? `${shake} 320ms ${EASING.standard}` : 'none',
}));

type CounterSeverity = 'normal' | 'amber' | 'red';

const Counter = styled(Typography, {
  shouldForwardProp: (p) => p !== 'severity',
})<{ severity: CounterSeverity }>(({ theme, severity }) => ({
  alignSelf: 'flex-end',
  marginTop: theme.spacing(0.5),
  color:
    severity === 'red'
      ? theme.vars.palette.error.main
      : severity === 'amber'
        ? COLORS.warningDk
        : theme.vars.palette.text.disabled,
  transition: `color ${DURATION.fast}ms ${EASING.standard}`,
}));

const Hint = styled(Typography)(({ theme }) => ({
  color: theme.vars.palette.error.main,
  marginTop: theme.spacing(0.5),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MAX_CHARS = LISTING_CHAR_LIMITS.keywords_per_language;

const totalLength = (list: string[]): number => list.join(', ').length;

const getSeverity = (length: number): CounterSeverity => {
  if (length >= MAX_CHARS) return 'red';
  if (length >= Math.floor(MAX_CHARS * 0.9)) return 'amber';
  return 'normal';
};

/** Strip forbidden delimiters (AC-110) + split on them so pasted `dog, cat`
 *  lands as two chips. Trimmed, empty entries dropped. */
const splitBuffer = (raw: string): string[] =>
  raw
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeywordsChipFieldProps {
  /** Current keywords for the active language (server-side). */
  value: string[];
  /** Active language -- displayed in the counter hint. */
  lang: ListingLanguage;
  /** Called when a new chip is committed. Receives the trimmed keyword. */
  onCommit: (keyword: string) => void | Promise<void>;
  /** Called when a chip is deleted. Receives the chip index. */
  onRemove: (idx: number) => void | Promise<void>;
  /** Render disabled + show empty state hint. */
  disabled?: boolean;
  /** Hint shown when the field is disabled. */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const KeywordsChipField = ({
  value,
  lang,
  onCommit,
  onRemove,
  disabled = false,
  disabledReason,
}: KeywordsChipFieldProps) => {
  const { t } = useTranslation();
  const [buffer, setBuffer] = useState('');
  const [shaking, setShaking] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const currentLen = totalLength(value);
  const severity = getSeverity(currentLen);

  const triggerShake = useCallback((reason: string) => {
    setHint(reason);
    setShaking(false);
    // Force next frame so the animation re-fires even on consecutive rejects.
    requestAnimationFrame(() => setShaking(true));
    window.setTimeout(() => {
      setShaking(false);
    }, 340);
  }, []);

  const tryCommit = useCallback(
    (candidate: string) => {
      const entries = splitBuffer(candidate);
      if (entries.length === 0) return;
      const lowerExisting = new Set(value.map((v) => v.toLowerCase()));
      let committed = 0;
      let rejectedLimit = 0;
      let projected = [...value];
      for (const e of entries) {
        if (lowerExisting.has(e.toLowerCase())) continue;
        const wouldBe = [...projected, e];
        if (totalLength(wouldBe) > MAX_CHARS) {
          rejectedLimit += 1;
          continue;
        }
        projected = wouldBe;
        lowerExisting.add(e.toLowerCase());
        void onCommit(e);
        committed += 1;
      }
      if (committed === 0 && rejectedLimit > 0) {
        triggerShake(
          t('publish.edit.global.keywords.limitReached', {
            defaultValue: 'Limit reached',
          }),
        );
        return;
      }
      if (committed === 0) {
        triggerShake(
          t('publish.edit.global.keywords.duplicate', {
            defaultValue: 'Already in the list',
          }),
        );
        return;
      }
      setHint(null);
    },
    [value, onCommit, triggerShake, t],
  );

  const handleInputChange = (raw: string) => {
    // Strip forbidden chars mid-buffer (AC-110). If the raw included a
    // delimiter, the part BEFORE it commits, the part after stays buffered.
    if (/[,;]/.test(raw)) {
      const parts = raw.split(/[,;]/);
      const toCommit = parts.slice(0, -1).join(',');
      const remainder = parts[parts.length - 1];
      if (toCommit.trim()) tryCommit(toCommit);
      setBuffer(remainder.replace(/[,;]/g, ''));
      return;
    }
    setBuffer(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && buffer.trim()) {
      e.preventDefault();
      tryCommit(buffer);
      setBuffer('');
    }
  };

  const handleBlur = () => {
    if (buffer.trim()) {
      tryCommit(buffer);
      setBuffer('');
    }
  };

  const label = t('publish.edit.global.keywords.label', {
    defaultValue: 'Keywords',
  });

  const placeholder = useMemo(
    () =>
      t('publish.edit.global.keywords.placeholder', {
        defaultValue: 'Add keyword... (Enter or comma to commit)',
      }),
    [t],
  );

  return (
    <FieldRoot shaking={shaking} data-testid="KeywordsChipField">
      <Typography
        variant="overline"
        color="text.secondary"
        component="label"
        sx={{ mb: 0.5 }}
      >
        {label} ({lang.toUpperCase()})
      </Typography>
      <Autocomplete
        multiple
        freeSolo
        open={false}
        disabled={disabled}
        options={[] as string[]}
        value={value}
        inputValue={buffer}
        onInputChange={(_e, next, reason) => {
          if (reason === 'reset') return;
          handleInputChange(next);
        }}
        onChange={(_e, _next, reason, details) => {
          // We only act on removals here; commits flow through key/blur
          // so we can enforce 50-char + duplicate rules in one place.
          if (reason === 'removeOption' && details?.option) {
            const idx = value.findIndex((v) => v === details.option);
            if (idx >= 0) void onRemove(idx);
          }
        }}
        renderTags={(tags, getTagProps) =>
          tags.map((option, index) => {
            const { key, ...rest } = getTagProps({ index });
            return (
              <Chip
                {...rest}
                key={key}
                label={option}
                size="small"
                onDelete={() => void onRemove(index)}
                data-testid={`KeywordsChipField-chip-${index}`}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={value.length === 0 ? placeholder : ''}
            size="small"
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            inputProps={{
              ...params.inputProps,
              'aria-label': label,
              'data-testid': 'KeywordsChipField-input',
            }}
          />
        )}
      />
      {disabled && disabledReason ? (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5 }}>
          {disabledReason}
        </Typography>
      ) : null}
      {hint ? (
        <Hint variant="caption" data-testid="KeywordsChipField-hint">
          {hint}
        </Hint>
      ) : null}
      <Counter
        variant="caption"
        severity={severity}
        data-testid="KeywordsChipField-counter"
      >
        {currentLen}/{MAX_CHARS}
      </Counter>
    </FieldRoot>
  );
};

export default KeywordsChipField;
