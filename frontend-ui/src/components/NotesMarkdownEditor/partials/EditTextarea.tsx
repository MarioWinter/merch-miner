/**
 * NotesMarkdownEditor — Edit-mode textarea (Phase 3 shell).
 *
 * Thin wrapper around MUI TextField configured for auto-grow + manual
 * vertical resize. Slash-menu wiring lands in Phase 4 (see marker below).
 */
import { forwardRef, type Ref } from 'react';
import { TextField } from '@mui/material';

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

  // Phase 4: slash menu wires here (consumes the ref + onChange).
  return (
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
          ref,
          style: { resize: 'vertical' },
          'aria-label': ariaLabel,
        },
      }}
    />
  );
});

EditTextarea.displayName = 'EditTextarea';

export default EditTextarea;
