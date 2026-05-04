/**
 * PROJ-20 Phase 3.2 — SmartTextarea
 *
 * Uncontrolled-with-imperative-API contenteditable. The DOM is the source
 * of truth while the user is typing; React only mutates it when the parent
 * calls one of the imperative methods (`insertChip`, `clear`, ...).
 *
 * Why: a controlled `dangerouslySetInnerHTML` rebuild on every keystroke
 * destroys the caret. The uncontrolled-imperative pattern keeps the
 * native editing experience intact while still allowing programmatic
 * mutation (the @-mention picker calls `insertChip`).
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import {
  CHIP_CLASS,
  CHIP_LABEL_CLASS,
  CHIP_REMOVE_CLASS,
} from './partials/NicheChip';
import { useAtomicChip } from './hooks/useAtomicChip';
import type { ParsedChip } from './utils/parseChipText';

export interface SmartTextareaValue {
  text: string;
  chip: ParsedChip | null;
}

export interface SmartTextareaHandle {
  getValue: () => SmartTextareaValue;
  insertChip: (niche: ParsedChip) => void;
  removeChip: () => void;
  clear: () => void;
  focus: () => void;
  /**
   * PROJ-20 Phase 3.3 — exposes the inner contenteditable div so that
   * external hooks (e.g. `useMentionTrigger`) can attach delegated
   * event listeners without monkey-patching internals.
   */
  getEditableElement: () => HTMLDivElement | null;
}

export interface SmartTextareaProps {
  placeholder?: string;
  onValueChange?: (value: SmartTextareaValue) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  appearance: 'floating' | 'panel';
}

// Editable surface — re-uses Phase 3.1 placeholder pattern but switches
// the empty-state signal from `:empty` to a `data-has-content` attribute
// so a chip-only message still hides the placeholder correctly.
const Editable = styled('div')(({ theme }) => ({
  minHeight: 48,
  maxHeight: 200,
  overflowY: 'auto',
  outline: 'none',
  padding: theme.spacing(1, 1),
  fontFamily: theme.typography.body1.fontFamily,
  fontSize: theme.typography.body1.fontSize,
  lineHeight: 1.5,
  color: theme.vars.palette.text.primary,
  caretColor: theme.vars.palette.primary.main,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  position: 'relative',

  // Placeholder: only visible when data-has-content="false"
  '&[data-has-content="false"]::before': {
    content: 'attr(data-placeholder)',
    color: theme.vars.palette.text.disabled,
    pointerEvents: 'none',
    position: 'absolute',
    left: theme.spacing(1),
    top: theme.spacing(1),
  },
  '&[data-has-content="true"]::before': {
    display: 'none',
  },

  '&[aria-disabled="true"]': {
    opacity: 0.5,
    pointerEvents: 'none',
  },

  // Atomic chip styling — uses primary brand color for the border + label.
  [`& .${CHIP_CLASS}`]: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.25),
    padding: theme.spacing(0.125, 0.25, 0.125, 0.75),
    margin: theme.spacing(0, 0.25),
    borderRadius: 999,
    backgroundColor: theme.vars.palette.action.selected,
    color: theme.vars.palette.primary.main,
    border: `1px solid ${theme.vars.palette.primary.main}`,
    fontSize: '0.875rem',
    lineHeight: 1.4,
    userSelect: 'none',
    verticalAlign: 'baseline',
    whiteSpace: 'nowrap',
  },
  [`& .${CHIP_LABEL_CLASS}`]: {
    fontWeight: 500,
  },
  [`& .${CHIP_REMOVE_CLASS}`]: {
    all: 'unset',
    cursor: 'pointer',
    width: 18,
    height: 18,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.95rem',
    lineHeight: 1,
    color: 'inherit',
    transition: 'background-color 120ms ease',
    '&:hover, &:focus-visible': {
      backgroundColor: theme.vars.palette.primary.main,
      color: theme.vars.palette.primary.contrastText,
      outline: 'none',
    },
  },
}));

const SmartTextarea = forwardRef<SmartTextareaHandle, SmartTextareaProps>(
  function SmartTextarea(
    { placeholder, onValueChange, onSubmit, disabled, ariaLabel, appearance },
    ref,
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const { t } = useTranslation();
    const removeChipLabel = t('search.chatBar.removeChip');

    const {
      insertChipAtCursor,
      removeExistingChip,
      parseValue,
      handleBackspaceGuard,
    } = useAtomicChip(rootRef);

    // Sync the data-has-content attribute + emit value change.
    const syncState = useCallback((): SmartTextareaValue => {
      const root = rootRef.current;
      const value = parseValue();
      if (root) {
        const hasContent = value.text.length > 0 || value.chip !== null;
        root.setAttribute('data-has-content', hasContent ? 'true' : 'false');
      }
      onValueChange?.(value);
      return value;
    }, [parseValue, onValueChange]);

    // ---------- imperative handle ----------
    useImperativeHandle(
      ref,
      (): SmartTextareaHandle => ({
        getValue: () => parseValue(),
        insertChip: (niche) => {
          insertChipAtCursor(
            { niche_id: niche.niche_id, niche_name: niche.niche_name },
            removeChipLabel,
          );
          syncState();
        },
        removeChip: () => {
          if (removeExistingChip()) {
            syncState();
          }
        },
        clear: () => {
          const root = rootRef.current;
          if (root) {
            root.innerHTML = '';
          }
          syncState();
        },
        focus: () => {
          rootRef.current?.focus();
        },
        getEditableElement: () => rootRef.current,
      }),
      [
        parseValue,
        insertChipAtCursor,
        removeExistingChip,
        removeChipLabel,
        syncState,
      ],
    );

    // ---------- DOM event handlers ----------
    const handleInput = useCallback(() => {
      syncState();
    }, [syncState]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Backspace at chip boundary — Safari fallback
        handleBackspaceGuard(event);

        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit?.();
        }
      },
      [handleBackspaceGuard, onSubmit],
    );

    const handleClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const removeBtn = target.closest('[data-chip-remove]');
        if (removeBtn) {
          event.preventDefault();
          if (removeExistingChip()) {
            syncState();
            rootRef.current?.focus();
          }
        }
      },
      [removeExistingChip, syncState],
    );

    // Initial state sync (placeholder visibility) on mount.
    useEffect(() => {
      syncState();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <Editable
        ref={rootRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? placeholder ?? ''}
        aria-disabled={disabled ? 'true' : 'false'}
        data-testid="chat-input-editable"
        data-appearance={appearance}
        data-placeholder={placeholder ?? ''}
        data-has-content="false"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      />
    );
  },
);

export default SmartTextarea;
