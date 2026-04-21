import { useRef, useState, useEffect, useCallback } from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { COLORS } from '@/style/constants';

// ---------------------------------------------------------------------------
// Constants (kept in-file to avoid a shared util for a single consumer)
// ---------------------------------------------------------------------------

const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 20;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignCardTagEditorProps {
  initialTags: string[];
  onCommit: (tags: string[]) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Styled
// ---------------------------------------------------------------------------

const EditorRoot = styled('div')({
  width: '100%',
});

const CompactAutocomplete = styled(Autocomplete<string, true, false, true>)({
  '& .MuiOutlinedInput-root': {
    padding: 2,
    minHeight: 28,
    backgroundColor: alpha(COLORS.ink, 0.25),
    fontSize: '0.75rem',
  },
  '& .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.cyan, 0.3),
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    borderColor: alpha(COLORS.cyan, 0.5),
  },
  '& .MuiAutocomplete-tag': {
    height: 18,
    fontSize: '0.6875rem',
    margin: 1,
    backgroundColor: alpha(COLORS.cyan, 0.15),
    color: COLORS.cyan,
  },
  '& input': {
    fontSize: '0.75rem',
    minWidth: 40,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DesignCardTagEditor = ({
  initialTags,
  onCommit,
  onCancel,
}: DesignCardTagEditorProps) => {
  const { t } = useTranslation();
  const [value, setValue] = useState<string[]>(() => [...initialTags]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Track whether we already finalized (commit/cancel) to avoid double-firing
  // onCommit after Escape triggers a blur event.
  const finalizedRef = useRef(false);

  useEffect(() => {
    // Autofocus after mount — Autocomplete renders its own <input>, so we
    // defer the focus until the next tick to guarantee it's in the DOM.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const normalize = (raw: string): string | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.length > MAX_TAG_LENGTH) return null;
    return trimmed;
  };

  const addToken = useCallback(
    (raw: string): boolean => {
      const token = normalize(raw);
      if (!token) return false;
      if (value.includes(token)) return false;
      if (value.length >= MAX_TAGS) return false;
      setValue((prev) => [...prev, token]);
      return true;
    },
    [value],
  );

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Comma commits the current token (Enter is already handled by Autocomplete's
    // freeSolo behaviour but we keep a guard for duplicates + max cap).
    if (event.key === ',') {
      event.preventDefault();
      if (addToken(inputValue)) setInputValue('');
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finalizedRef.current = true;
      onCancel();
      return;
    }
    if (event.key === 'Enter') {
      // Autocomplete will fire onChange with the freeSolo value, but we still
      // need to prevent duplicates / whitespace-only from being added by the
      // internal logic. onChange handler below performs the real validation.
      const trimmed = inputValue.trim();
      if (!trimmed) {
        event.preventDefault();
        finalizedRef.current = true;
        onCommit(value);
      }
    }
  };

  const handleChange = (_e: React.SyntheticEvent, next: string[]) => {
    // Autocomplete gives us the full next array including whatever freeSolo
    // added. We rebuild it from scratch honouring dedup + length + max cap.
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of next) {
      const token = normalize(item);
      if (!token) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      cleaned.push(token);
      if (cleaned.length >= MAX_TAGS) break;
    }
    setValue(cleaned);
  };

  const handleBlur = () => {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    // Commit whatever is currently staged. Pending input text (not yet a chip)
    // is folded in as the final chip when possible.
    const pending = inputValue.trim();
    if (pending && !value.includes(pending) && value.length < MAX_TAGS) {
      const token = normalize(pending);
      if (token) {
        onCommit([...value, token]);
        return;
      }
    }
    onCommit(value);
  };

  return (
    <EditorRoot>
      <CompactAutocomplete
        multiple
        freeSolo
        options={[]}
        value={value}
        inputValue={inputValue}
        onInputChange={(_e, v) => setInputValue(v)}
        onChange={handleChange}
        onBlur={handleBlur}
        disableClearable
        size="small"
        renderTags={(tags, getTagProps) =>
          tags.map((tag, index) => {
            const { key, ...chipProps } = getTagProps({ index });
            return (
              <Chip
                key={key}
                {...chipProps}
                label={tag}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.6875rem',
                  backgroundColor: alpha(COLORS.cyan, 0.15),
                  color: COLORS.cyan,
                }}
              />
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            variant="outlined"
            placeholder={t('publish.card.tagEditor.placeholder', {
              defaultValue: 'Add tag…',
            })}
            inputRef={inputRef}
            onKeyDown={handleInputKeyDown}
            slotProps={{
              htmlInput: {
                ...params.inputProps,
                maxLength: MAX_TAG_LENGTH,
                'aria-label': t('publish.card.tagEditor.ariaLabel', {
                  defaultValue: 'Edit design tags',
                }),
              },
            }}
          />
        )}
      />
    </EditorRoot>
  );
};

export default DesignCardTagEditor;
