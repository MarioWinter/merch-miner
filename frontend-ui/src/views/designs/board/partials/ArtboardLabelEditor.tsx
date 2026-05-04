import { useCallback, useEffect, useRef } from 'react';
import { styled } from '@mui/material/styles';

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const EditInput = styled('input')(({ theme }) => ({
  position: 'absolute',
  zIndex: 100,
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  padding: '2px 4px',
  border: `1px solid ${theme.vars.palette.primary.main}`,
  borderRadius: 4,
  outline: 'none',
  color: theme.vars.palette.text.primary,
  backgroundColor: theme.vars.palette.background.paper,
  minWidth: 80,
  maxWidth: 260,
}));

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface ArtboardLabelEditorProps {
  /** Current label value */
  value: string;
  /** Position in screen (pixel) coordinates */
  screenX: number;
  screenY: number;
  /** Called when editing is confirmed */
  onConfirm: (newLabel: string) => void;
  /** Called when editing is cancelled */
  onCancel: () => void;
}

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const ArtboardLabelEditor = ({
  value,
  screenX,
  screenY,
  onConfirm,
  onCancel,
}: ArtboardLabelEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const trimmed = (e.currentTarget.value || '').trim();
        onConfirm(trimmed || value);
      } else if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onConfirm, onCancel, value],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const trimmed = (e.currentTarget.value || '').trim();
      onConfirm(trimmed || value);
    },
    [onConfirm, value],
  );

  return (
    <EditInput
      ref={inputRef}
      defaultValue={value}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={{ left: screenX, top: screenY }}
      aria-label="Artboard label"
    />
  );
};

export default ArtboardLabelEditor;
