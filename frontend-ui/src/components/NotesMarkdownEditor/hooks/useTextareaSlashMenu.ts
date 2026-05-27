/**
 * FIX-ai-research-like-and-notes-editor — Phase 4B
 *
 * Slash-menu state machine for a `<textarea>` (NOT contenteditable). Mirrors
 * the shape of `useCommandTrigger` but uses `selectionStart`/`selectionEnd`
 * and the `textarea-caret` library for caret coordinates.
 *
 * State machine
 * --------------
 *  CLOSED -> OPEN     : `/` typed at start-of-text or after whitespace.
 *  OPEN   -> CLOSED   :
 *    - Esc pressed
 *    - Space (or any whitespace) typed   → leaves `/query` as plain text
 *    - Backspace past `/`
 *    - Click outside / blur (caller wires via `onClose` on the Popper)
 *  OPEN   -> Filtering: any non-control keystroke updates `query`.
 *  OPEN   -> Commit  : Enter or Tab → strip `/query`, dispatch insertion
 *                       strategy, restore caret/selection, close.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import getCaretCoordinates from 'textarea-caret';
import { useTranslation } from 'react-i18next';
import {
  COMMANDS,
  findMatches,
  type SlashCommand,
} from '../utils/commandRegistry';
import {
  applyBlock,
  applyInline,
  applyLinePrefix,
} from '../utils/insertionStrategies';

export interface SlashAnchorRect {
  top: number;
  left: number;
  height: number;
}

export interface SlashMenuProps {
  open: boolean;
  /** Caret rect RELATIVE to the textarea's content origin (top-left). */
  anchorRect: SlashAnchorRect | null;
  query: string;
  activeIndex: number;
  commands: SlashCommand[];
  onSelect: (cmd: SlashCommand) => void;
  onHoverIndex: (i: number) => void;
  onClose: () => void;
}

export interface UseTextareaSlashMenuArgs {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

export interface UseTextareaSlashMenuReturn {
  menuProps: SlashMenuProps;
}

const isWhitespace = (ch: string | undefined): boolean => {
  if (ch === undefined) return true;
  return /\s/.test(ch);
};

export const useTextareaSlashMenu = ({
  textareaRef,
  value,
  onChange,
}: UseTextareaSlashMenuArgs): UseTextareaSlashMenuReturn => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<SlashAnchorRect | null>(null);

  // Index of the `/` character in `value` — set on open, cleared on close.
  const triggerOffsetRef = useRef<number | null>(null);
  // Pending caret-restore after onChange flush.
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(
    null,
  );

  // Build a translated label list so findMatches() can do case-insensitive
  // substring matching on i18n labels. Recomputed on language change.
  const translatedLabels = useMemo(
    () =>
      COMMANDS.map((c) => ({
        id: c.id,
        label: t(c.labelKey, { defaultValue: c.id }),
      })),
    [t],
  );

  const filtered = useMemo(
    () => findMatches(query, translatedLabels),
    [query, translatedLabels],
  );
  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    setAnchorRect(null);
    triggerOffsetRef.current = null;
  }, []);

  const computeAnchor = useCallback((): SlashAnchorRect | null => {
    const el = textareaRef.current;
    if (!el) return null;
    const pos = el.selectionEnd;
    const coords = getCaretCoordinates(el, pos);
    return {
      top: coords.top - el.scrollTop,
      left: coords.left - el.scrollLeft,
      height: coords.height,
    };
  }, [textareaRef]);

  // Restore caret/selection after onChange flushes (React-controlled textarea
  // re-renders may overwrite `selectionStart`/`selectionEnd`).
  useEffect(() => {
    const pending = pendingSelectionRef.current;
    if (!pending) return;
    const el = textareaRef.current;
    if (!el) return;
    // Defer one rAF so React's commit + DOM update both completed.
    const raf = requestAnimationFrame(() => {
      try {
        el.setSelectionRange(pending.start, pending.end);
      } catch {
        // Defensive — invalid range, ignore.
      }
      pendingSelectionRef.current = null;
    });
    return () => cancelAnimationFrame(raf);
  }, [value, textareaRef]);

  const commitCommand = useCallback(
    (cmd: SlashCommand) => {
      const el = textareaRef.current;
      const triggerOffset = triggerOffsetRef.current;
      if (!el || triggerOffset === null) {
        closeMenu();
        return;
      }
      const caret = el.selectionEnd;
      let result;
      if (cmd.behaviour === 'line-prefix') {
        result = applyLinePrefix(value, triggerOffset, caret, cmd.insert);
      } else if (cmd.behaviour === 'block') {
        result = applyBlock(
          value,
          triggerOffset,
          caret,
          cmd.insert,
          cmd.caretOffsetFromInsertStart,
        );
      } else {
        result = applyInline(value, triggerOffset, caret, cmd.insert, {
          caretOffsetFromInsertStart: cmd.caretOffsetFromInsertStart,
          selectionStart: cmd.selectionStart,
          selectionEnd: cmd.selectionEnd,
        });
      }
      pendingSelectionRef.current = {
        start: result.newSelectionStart,
        end: result.newSelectionEnd,
      };
      onChange(result.newText);
      closeMenu();
    },
    [value, onChange, textareaRef, closeMenu],
  );

  // Mirror activeIndex + commit handler in refs so the DOM listeners always
  // see the latest values without re-binding on every render.
  const activeIndexRef = useRef(activeIndex);
  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);
  const commitRef = useRef(commitCommand);
  useEffect(() => {
    commitRef.current = commitCommand;
  }, [commitCommand]);

  // DOM listeners — KEYDOWN ONLY. We intentionally do NOT listen for `input`
  // here. Setting state synchronously inside a native input handler racing
  // with React's controlled-component sync caused the textarea value to
  // revert to its stale prop value (the user's typed char never reached the
  // form state). Query is derived from the `value` prop in a `useEffect`
  // below — same source of truth React uses.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Open trigger.
      if (
        event.key === '/' &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        const caretBefore = el.selectionEnd;
        const prevChar =
          caretBefore > 0 ? el.value[caretBefore - 1] : undefined;
        if (!isWhitespace(prevChar)) return; // mid-word `/` — ignore.

        // Defer until after the `/` lands in the value, then anchor.
        requestAnimationFrame(() => {
          const elNow = textareaRef.current;
          if (!elNow) return;
          // The `/` is now at index (selectionEnd - 1).
          const slashOffset = elNow.selectionEnd - 1;
          if (elNow.value[slashOffset] !== '/') return;
          triggerOffsetRef.current = slashOffset;
          setQuery('');
          setActiveIndex(0);
          setAnchorRect(computeAnchor());
          setOpen(true);
        });
        return;
      }

      if (!open) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => {
          const len = filteredRef.current.length;
          if (len === 0) return 0;
          return (i + 1) % len;
        });
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => {
          const len = filteredRef.current.length;
          if (len === 0) return 0;
          return (i - 1 + len) % len;
        });
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        const list = filteredRef.current;
        if (list.length > 0) {
          event.preventDefault();
          event.stopPropagation();
          const idx = Math.min(activeIndexRef.current, list.length - 1);
          commitRef.current(list[idx]);
          return;
        }
        // No matches → just close (leave `/query` as plain text).
        closeMenu();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeMenu();
        return;
      }
      if (event.key === ' ' || event.key === '\t') {
        // Whitespace terminates the trigger context.
        closeMenu();
        return;
      }
    };

    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [textareaRef, open, closeMenu, computeAnchor]);

  // Derive query from the controlled `value` prop on every change. This runs
  // after React commits the latest value, so DOM and React state are in sync.
  // The setState calls below are intentional — they reflect the new value
  // back into the menu's filter / anchor state. Cascading rerenders are
  // bounded because `setQuery`/`setActiveIndex` reach a fixed point quickly.
  useEffect(() => {
    if (!open) return;
    const el = textareaRef.current;
    if (!el) return;
    const trigger = triggerOffsetRef.current;
    if (trigger === null) return;
    const caret = el.selectionEnd;
    // Backspace past `/` or `/` was deleted → close.
    if (caret < trigger + 1 || value[trigger] !== '/') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      closeMenu();
      return;
    }
    const slice = value.slice(trigger + 1, caret);
    if (/\s/.test(slice)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      closeMenu();
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(slice);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveIndex(0);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnchorRect(computeAnchor());
  }, [value, open, textareaRef, closeMenu, computeAnchor]);

  const onSelect = useCallback(
    (cmd: SlashCommand) => commitCommand(cmd),
    [commitCommand],
  );
  const onHoverIndex = useCallback((i: number) => setActiveIndex(i), []);

  const menuProps: SlashMenuProps = {
    open,
    anchorRect,
    query,
    activeIndex,
    commands: filtered,
    onSelect,
    onHoverIndex,
    onClose: closeMenu,
  };

  return { menuProps };
};
