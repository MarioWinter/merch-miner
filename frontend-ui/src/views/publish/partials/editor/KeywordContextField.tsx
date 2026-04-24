import { useState } from 'react';
import { Box, Chip, Stack, TextField, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const FieldWrapper = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
});

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    backgroundColor: theme.vars.palette.background.paper,
    borderRadius: 8,
    ...theme.typography.body2,
  },
  '& .MuiOutlinedInput-input': {
    ...theme.typography.body2,
  },
}));

type CounterSeverity = 'normal' | 'amber' | 'red';

const CharCounter = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'severity',
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

// Mirrors the ListingField truncated chip so the visual vocabulary stays
// consistent across all AI-Improve-writable fields.
const TruncatedChip = styled(Chip)(({ theme }) => ({
  height: 20,
  backgroundColor: alpha(COLORS.warningDk, 0.16),
  color: COLORS.warningDk,
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 600,
  '& .MuiChip-icon': {
    color: COLORS.warningDk,
    fontSize: 12,
    marginLeft: theme.spacing(0.75),
  },
  '& .MuiChip-label': {
    paddingInline: theme.spacing(0.75),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getSeverity = (length: number, max: number): CounterSeverity => {
  if (length >= max) return 'red';
  if (length >= Math.floor(max * 0.9)) return 'amber';
  return 'normal';
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_CHARS = 500;
const DEFAULT_ROWS = 4;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeywordContextFieldProps {
  /** Current server-side `keyword_context` value. */
  value: string;
  /** Fires on every keystroke with the buffered value. Parent wires to
   *  `textSetters.onChange('keyword_context', v)`. */
  onChange: (value: string) => void;
  /** Fires on blur with the final buffered value. Parent wires to
   *  `textSetters.onBlur('keyword_context', v)` — the hook PATCHes if
   *  dirty. */
  onBlur: (value: string) => void;
  /** Override the default 500-char cap (matches backend AC-73 limit). */
  maxChars?: number;
  /** Override the default 4-row textarea height. */
  rows?: number;
  /** Override the default i18n-derived label. */
  label?: string;
  /** Optional placeholder text shown inside the empty textarea. */
  placeholder?: string;
  /** Phase P7: shows an "AI truncated" chip when the last AI-Improve run
   *  shortened this field to fit its max-chars budget. */
  truncated?: boolean;
  /** Round-5: disabled when the user is editing a non-EN language tab —
   *  keyword_context is AI-input-only (AC-9) and not translated. */
  disabled?: boolean;
  /** Helper shown while disabled. */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Component — Phase P6 (replaces KeywordChipsField)
// ---------------------------------------------------------------------------

/**
 * Plain 500-char textarea for the listing's AI-prompt keyword context.
 * Replaces the legacy chip-based KeywordChipsField — the new AI-Improve
 * flow (Phase M/P7) wants a free-form paragraph, not tokenized chips.
 *
 * Architecture mirrors `ListingField`: controlled `value`, local buffer
 * synced via derived-during-render + equality-guarded state, on-blur-if-
 * dirty semantics owned by the caller's `textSetters` from
 * `useEditFormState`.
 */
const KeywordContextField = ({
  value,
  onChange,
  onBlur,
  maxChars = DEFAULT_MAX_CHARS,
  rows = DEFAULT_ROWS,
  label,
  placeholder,
  truncated = false,
  disabled = false,
  disabledReason,
}: KeywordContextFieldProps) => {
  const { t } = useTranslation();

  // Local buffer mirrors `ListingField`: re-sync on every server-value
  // change so tab/design switches + successful saves land cleanly.
  const [buffer, setBuffer] = useState(value);
  const [lastServerValue, setLastServerValue] = useState(value);
  if (lastServerValue !== value) {
    setLastServerValue(value);
    setBuffer(value);
  }

  const length = buffer.length;
  const severity = getSeverity(length, maxChars);
  const isOver = severity === 'red';
  const effectiveLabel =
    label ??
    t('publish.edit.fields.keywordContext', {
      defaultValue: 'Keyword Context',
    });
  const effectivePlaceholder =
    placeholder ??
    t('publish.edit.fields.keywordContextPlaceholder', {
      defaultValue:
        'Free-form notes to steer AI Improve — brand tone, avoid-words, audience.',
    });

  const truncatedLabel = t('publish.ai_improve.truncatedChip', {
    defaultValue: 'AI truncated',
  });

  return (
    <FieldWrapper data-testid="KeywordContextField">
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography
          variant="overline"
          color="text.secondary"
          component="label"
        >
          {effectiveLabel}
        </Typography>
        {truncated && (
          <TruncatedChip
            size="small"
            icon={<ContentCutOutlinedIcon />}
            label={truncatedLabel}
            data-testid="KeywordContextField-truncatedChip"
          />
        )}
      </Stack>
      <StyledTextField
        value={buffer}
        onChange={(e) => {
          const next = e.target.value;
          setBuffer(next);
          onChange(next);
        }}
        onBlur={() => onBlur(buffer)}
        fullWidth
        variant="outlined"
        size="small"
        multiline
        rows={rows}
        placeholder={effectivePlaceholder}
        disabled={disabled}
        helperText={disabled ? disabledReason : undefined}
        error={isOver}
        inputProps={{
          'aria-label': effectiveLabel,
          maxLength: maxChars,
        }}
      />
      <CharCounter
        variant="caption"
        severity={severity}
        data-testid="KeywordContextField-counter"
      >
        {length}/{maxChars}
      </CharCounter>
    </FieldWrapper>
  );
};

export default KeywordContextField;
