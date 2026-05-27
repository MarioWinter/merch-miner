/**
 * NotesMarkdownEditor — Edit-mode textarea.
 *
 * Phase 3 shell + Phase 4 slash-menu / Enter-continuation wiring. Owns its
 * own internal textarea ref for the hooks; the external `forwardRef` is
 * merged so consumers (and future tests) can still grab the DOM element.
 */
import { forwardRef, useCallback, useRef, type Ref } from 'react';
import { Box, TextField } from '@mui/material';
import { useTextareaSlashMenu } from '../hooks/useTextareaSlashMenu';
import { useListContinuation } from '../hooks/useListContinuation';
import SlashCommandMenu from './SlashCommandMenu';

export interface EditTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  minRows: number;
  maxRows: number;
  ariaLabel?: string;
  error?: boolean;
  helperText?: React.ReactNode;
  disabled?: boolean;
}

const EditTextarea = forwardRef((props: EditTextareaProps, ref: Ref<HTMLTextAreaElement>) => {
  const {
    value,
    onChange,
    onBlur,
    placeholder,
    minRows,
    maxRows,
    ariaLabel,
    error,
    helperText,
    disabled,
  } = props;

  // Internal ref for slash-menu hooks. Merged with the external `ref` so
  // consumers still get the DOM element.
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const setRefs = useCallback(
    (el: HTMLTextAreaElement | null) => {
      internalRef.current = el;
      if (typeof ref === 'function') {
        ref(el);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
      }
    },
    [ref],
  );

  const { menuProps } = useTextareaSlashMenu({
    textareaRef: internalRef,
    value,
    onChange,
  });
  useListContinuation({
    textareaRef: internalRef,
    value,
    onChange,
    enabled: !menuProps.open,
  });

  return (
    <Box sx={{ position: 'relative' }}>
      <TextField
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        multiline
        minRows={minRows}
        maxRows={maxRows}
        fullWidth
        size="small"
        error={error}
        helperText={helperText}
        disabled={disabled}
        slotProps={{
          htmlInput: {
            ref: setRefs,
            style: { resize: 'vertical' },
            'aria-label': ariaLabel,
          },
        }}
      />
      <SlashCommandMenu {...menuProps} textareaRef={internalRef} />
    </Box>
  );
});

EditTextarea.displayName = 'EditTextarea';

export default EditTextarea;
