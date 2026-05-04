/**
 * PROJ-20 Phase 3.5 — useCommandTrigger
 *
 * Companion to `useMentionTrigger` but for `/command` palette. Detects a
 * `/` keystroke at the *start* of the textarea OR after whitespace and
 * opens a Floating-UI dropdown of matching commands.
 *
 * State machine
 * --------------
 *  CLOSED -> OPEN  : `/` typed at start OR after whitespace, with no chip
 *                    interrupting the @-mention flow.
 *  OPEN   -> CLOSED:
 *    - ESC pressed
 *    - SPACE typed (terminates `/cmd` token, leaves text intact per AC-22)
 *    - Enter / click on a row (executes; also strips `/cmd` text from input)
 *    - Focus leaves the editable
 *    - User backspaces past the `/`
 *
 * Selection commit:
 *  - Looks up the command by exact-match name (substring matches mean
 *    multiple results are still showing — Enter picks the active row).
 *  - Removes the `/cmd` substring from the editor.
 *  - Calls `command.execute(commandContext)` — caller supplies the bag.
 *
 * Mutual exclusion with `useMentionTrigger`: both hooks listen on the same
 * editable, but `@` and `/` are distinct trigger characters and the `OPEN`
 * gate of each hook ignores keystrokes from the other. A single keystroke
 * never opens both pickers.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import type { SmartTextareaHandle } from '../SmartTextarea';
import {
  COMMANDS,
  findMatches,
  type Command,
  type CommandContext,
} from '../utils/commandRegistry';
import { getCursorRect } from '../utils/cursorRect';

const TERMINATE_CHARS = new Set([' ', '\t', '\n']);

const getCaretOffset = (root: HTMLElement): number | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const preCaret = document.createRange();
  preCaret.selectNodeContents(root);
  preCaret.setEnd(range.startContainer, range.startOffset);

  const fragment = preCaret.cloneContents();
  let count = 0;
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      count += node.nodeValue?.length ?? 0;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset?.nicheChip !== undefined) return;
    if (el.tagName === 'BR') {
      count += 1;
      return;
    }
    el.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  return count;
};

const getEditorText = (root: HTMLElement): string => {
  let out = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue ?? '';
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset?.nicheChip !== undefined) return;
    if (el.tagName === 'BR') {
      out += '\n';
      return;
    }
    el.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
};

const findTextNodeAtOffset = (
  root: HTMLElement,
  target: number,
): { node: Text; offset: number } | null => {
  let remaining = target;
  let result: { node: Text; offset: number } | null = null;
  const walk = (node: Node): boolean => {
    if (result) return true;
    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.nodeValue?.length ?? 0;
      if (remaining <= len) {
        result = { node: node as Text, offset: remaining };
        return true;
      }
      remaining -= len;
      return false;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const el = node as HTMLElement;
    if (el.dataset?.nicheChip !== undefined) return false;
    if (el.tagName === 'BR') {
      if (remaining <= 1) {
        result = null;
        return true;
      }
      remaining -= 1;
      return false;
    }
    for (const child of Array.from(el.childNodes)) {
      if (walk(child)) return true;
    }
    return false;
  };
  for (const child of Array.from(root.childNodes)) {
    if (walk(child)) break;
  }
  return result;
};

/**
 * Returns true if the character at `text[index - 1]` is a whitespace
 * terminator OR if `index === 0` (start of editor).
 */
const isAtWhitespaceBoundary = (text: string, index: number): boolean => {
  if (index <= 0) return true;
  const prev = text[index - 1];
  return TERMINATE_CHARS.has(prev);
};

export interface UseCommandTriggerArgs {
  smartTextareaRef: RefObject<SmartTextareaHandle | null>;
  /** Lazy getter so caller can build the bag with up-to-date hooks. */
  getCommandContext: () => CommandContext;
}

export interface CommandPaletteRenderProps {
  open: boolean;
  anchorRect: DOMRect | null;
  query: string;
  activeIndex: number;
  commands: Command[];
  onSelect: (cmd: Command) => void;
  onClose: () => void;
  onHoverIndex: (idx: number) => void;
}

export interface UseCommandTriggerReturn {
  paletteProps: CommandPaletteRenderProps;
}

export const useCommandTrigger = ({
  smartTextareaRef,
  getCommandContext,
}: UseCommandTriggerArgs): UseCommandTriggerReturn => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Caret offset where the `/` was typed — set on open, read on input/keys.
  const triggerOffsetRef = useRef<number | null>(null);

  // Stable getter wrapper — keep latest reference without re-attaching DOM
  // listeners every render.
  const getCtxRef = useRef(getCommandContext);
  useEffect(() => {
    getCtxRef.current = getCommandContext;
  }, [getCommandContext]);

  const filtered = useMemo(() => findMatches(query), [query]);
  const filteredRef = useRef(filtered);
  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    setAnchorRect(null);
    triggerOffsetRef.current = null;
  }, []);

  const reevaluateQuery = useCallback((root: HTMLElement): boolean => {
    const triggerOffset = triggerOffsetRef.current;
    if (triggerOffset === null) return false;
    const caret = getCaretOffset(root);
    if (caret === null || caret < triggerOffset) {
      return false;
    }
    const text = getEditorText(root);
    if (text[triggerOffset - 1] !== '/') {
      return false;
    }
    const slice = text.slice(triggerOffset, caret);
    for (const ch of slice) {
      if (TERMINATE_CHARS.has(ch)) {
        return false;
      }
    }
    setQuery(slice);
    const rect = getCursorRect(root);
    if (rect) setAnchorRect(rect);
    return true;
  }, []);

  /**
   * Strip the `/cmd` token from the editor (from `triggerOffset - 1` to the
   * current caret position). Caller responsibility to close the palette
   * after; we leave it open so the executor can defer text-strip if needed.
   */
  const stripCommandText = useCallback(() => {
    const handle = smartTextareaRef.current;
    const root = handle?.getEditableElement();
    const triggerOffset = triggerOffsetRef.current;
    if (!handle || !root || triggerOffset === null) return;

    const caret = getCaretOffset(root);
    if (caret === null) return;
    const start = triggerOffset - 1;
    const end = caret;

    const startNode = findTextNodeAtOffset(root, start);
    const endNode = findTextNodeAtOffset(root, end);
    if (!startNode || !endNode) return;
    try {
      const range = document.createRange();
      range.setStart(startNode.node, startNode.offset);
      range.setEnd(endNode.node, endNode.offset);
      range.deleteContents();
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      // Fire input event so SmartTextarea recomputes data-has-content.
      root.dispatchEvent(new Event('input', { bubbles: true }));
    } catch {
      // Defensive — if range manipulation fails, leave text alone.
    }
  }, [smartTextareaRef]);

  const commitCommand = useCallback(
    (cmd: Command) => {
      stripCommandText();
      try {
        cmd.execute(getCtxRef.current());
      } finally {
        closePalette();
      }
    },
    [stripCommandText, closePalette],
  );

  const onSelect = useCallback(
    (cmd: Command) => commitCommand(cmd),
    [commitCommand],
  );

  const onHoverIndex = useCallback((idx: number) => setActiveIndex(idx), []);

  useEffect(() => {
    const handle = smartTextareaRef.current;
    const root = handle?.getEditableElement();
    if (!root) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Open trigger: literal `/` keystroke at start-of-text or after WS.
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        // Snapshot pre-keystroke state so we can decide whether THIS slash
        // qualifies. Caret is currently at the position WHERE `/` will land.
        const caretBefore = getCaretOffset(root);
        if (caretBefore === null) return;
        const textBefore = getEditorText(root);
        const allowed = isAtWhitespaceBoundary(textBefore, caretBefore);
        if (!allowed) return; // typed `/` mid-word — ignore.

        // Defer one tick so the `/` lands first, then anchor.
        requestAnimationFrame(() => {
          const r = handle?.getEditableElement();
          if (!r) return;
          const caret = getCaretOffset(r);
          if (caret === null) return;
          triggerOffsetRef.current = caret;
          const rect = getCursorRect(r);
          if (rect) setAnchorRect(rect);
          setQuery('');
          setActiveIndex(0);
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
          commitCommand(list[Math.min(activeIndex, list.length - 1)]);
          return;
        }
        // Empty list -> Enter just closes (per AC-22 leaves text intact).
        closePalette();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePalette();
        return;
      }
      if (event.key === ' ') {
        // Space terminates the `/cmd` token without executing.
        closePalette();
        return;
      }
    };

    const onInput = () => {
      if (!open) return;
      const r = handle?.getEditableElement();
      if (!r) return;
      const stillOpen = reevaluateQuery(r);
      if (!stillOpen) {
        closePalette();
      } else {
        setActiveIndex(0);
      }
    };

    const onBlur = (event: FocusEvent) => {
      if (!open) return;
      const next = event.relatedTarget as HTMLElement | null;
      if (next?.closest('[data-testid="command-palette"]')) return;
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest('[data-testid="command-palette"]')) return;
        closePalette();
      }, 120);
    };

    root.addEventListener('keydown', onKeyDown, true);
    root.addEventListener('input', onInput);
    root.addEventListener('blur', onBlur);

    return () => {
      root.removeEventListener('keydown', onKeyDown, true);
      root.removeEventListener('input', onInput);
      root.removeEventListener('blur', onBlur);
    };
  }, [
    smartTextareaRef,
    open,
    activeIndex,
    closePalette,
    commitCommand,
    reevaluateQuery,
  ]);

  const paletteProps: CommandPaletteRenderProps = {
    open,
    anchorRect,
    query,
    activeIndex,
    commands: filtered.length > 0 ? filtered : COMMANDS.slice(0, 0),
    onSelect,
    onClose: closePalette,
    onHoverIndex,
  };

  return { paletteProps };
};
