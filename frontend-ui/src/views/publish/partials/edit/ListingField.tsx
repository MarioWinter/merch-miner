import { useState } from 'react';
import {
  Box,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import { useTranslation } from 'react-i18next';
import { COLORS, DURATION, EASING } from '@/style/constants';

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const FieldWrapper = styled(Box)({
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  '&:hover .chat-open, &:focus-within .chat-open': {
    opacity: 1,
  },
});

const InputWrapper = styled(Box)({
  position: 'relative',
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

// Inline warning chip shown after AI-Improve truncates this field
// server-side (Phase M). Amber tone to match the character-count
// `amber` branch — this is a soft warning, not an error.
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

// Hover-only Chat icon — opens PROJ-17 Chat with the field value as context
// (AC-72). Orthogonal to the header's central AI Improve button (Phase P7):
// per-field free-form refinement vs. one-shot full-listing rewrite.
const ChatHoverButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(0.5),
  right: theme.spacing(0.5),
  padding: theme.spacing(0.25),
  color: COLORS.cyan,
  opacity: 0,
  transition: `opacity ${DURATION.fast}ms ${EASING.standard}`,
  '&:focus-visible': {
    opacity: 1,
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
// Props
// ---------------------------------------------------------------------------

interface ListingFieldProps {
  /** Current server-side value (from the Listing record). Buffers locally
   *  until the user blurs; re-syncs when the server value changes. */
  value: string;
  /** Called on every keystroke with the buffered value. Parent wires
   *  this to `textSetters.onChange(field, value)`. */
  onChange: (value: string) => void;
  /** Called on blur with the final buffered value. Parent wires this to
   *  `textSetters.onBlur(field, value)` — the hook PATCHes if dirty. */
  onBlur: (value: string) => void;
  maxChars: number;
  label: string;
  multiline?: boolean;
  rows?: number;
  /** Inline error from schema validation (if any). */
  errorMessage?: string;
  /** AC-72: optional per-field Chat hover icon. Click forwards the current
   *  buffered value so Chat opens with that context. PROJ-17 will wire
   *  the actual Chat modal; until then this is a caller-provided stub. */
  onOpenChat?: (value: string) => void;
  /** Phase P7: surface an "AI truncated" chip when the last AI-Improve
   *  run had to shorten this field to fit its max-chars budget. */
  truncated?: boolean;
  /** Disabled with a tooltip — used by non-EN tabs on fields that are not
   *  translated (brand_name, keyword_context). */
  disabled?: boolean;
  /** Tooltip shown while the field is disabled. */
  disabledReason?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ListingField = ({
  value,
  onChange,
  onBlur,
  maxChars,
  label,
  multiline = false,
  rows,
  errorMessage,
  onOpenChat,
  truncated = false,
  disabled = false,
  disabledReason,
}: ListingFieldProps) => {
  const { t } = useTranslation();

  // Local buffer so typing feels instant even before the debounced /
  // on-blur PATCH commits. Re-sync whenever the server value changes
  // (tab switch, external edit, successful save). Derived-during-render
  // + equality-guarded per `react-hooks/set-state-in-effect`.
  const [buffer, setBuffer] = useState(value);
  const [lastServerValue, setLastServerValue] = useState(value);
  if (lastServerValue !== value) {
    setLastServerValue(value);
    setBuffer(value);
  }

  const length = buffer.length;
  const severity = getSeverity(length, maxChars);
  const isOver = severity === 'red';

  const chatLabel = t('publish.edit.fields.openChat', {
    defaultValue: 'Open Chat for this field',
  });

  const handleChange = (next: string) => {
    setBuffer(next);
    onChange(next);
  };

  const handleBlur = () => {
    onBlur(buffer);
  };

  const truncatedLabel = t('publish.ai_improve.truncatedChip', {
    defaultValue: 'AI truncated',
  });

  return (
    <FieldWrapper>
      <Stack direction="row" alignItems="center" gap={1}>
        <Typography
          variant="overline"
          color="text.secondary"
          component="label"
        >
          {label}
        </Typography>
        {truncated && (
          <TruncatedChip
            size="small"
            icon={<ContentCutOutlinedIcon />}
            label={truncatedLabel}
            data-testid="ListingField-truncatedChip"
          />
        )}
      </Stack>

      <InputWrapper>
        <StyledTextField
          value={buffer}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          fullWidth
          variant="outlined"
          size="small"
          multiline={multiline}
          rows={multiline ? (rows ?? 3) : undefined}
          error={Boolean(errorMessage) || isOver}
          helperText={errorMessage ?? (disabled ? disabledReason : undefined)}
          disabled={disabled}
          inputProps={{ 'aria-label': label }}
        />
        {onOpenChat && (
          <Tooltip title={chatLabel} arrow placement="top">
            <ChatHoverButton
              className="chat-open"
              size="small"
              onClick={() => onOpenChat(buffer)}
              aria-label={chatLabel}
            >
              <AutoFixHighOutlinedIcon sx={{ fontSize: 16 }} />
            </ChatHoverButton>
          </Tooltip>
        )}
      </InputWrapper>
      <CharCounter variant="caption" severity={severity}>
        {length}/{maxChars}
      </CharCounter>
    </FieldWrapper>
  );
};

export default ListingField;
