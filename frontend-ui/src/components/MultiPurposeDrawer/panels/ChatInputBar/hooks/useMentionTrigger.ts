/**
 * PROJ-20 Phase 3.3 — useMentionTrigger
 *
 * Wires SmartTextarea key/input events to MentionPicker open/close + query
 * state. Listens directly on the contenteditable element via the ref the
 * parent passes in (SmartTextarea exposes `getEditableElement` for this).
 *
 * State machine
 * --------------
 *  CLOSED -> OPEN  : user types `@` (no chip already present, or replacement
 *                    will replace per AC-14)
 *  OPEN   -> CLOSED: user picks niche, presses ESC, focus leaves editor,
 *                    user types whitespace/punctuation that ends the @-token,
 *                    backspace past `@`
 *
 * While OPEN we track:
 *  - `triggerOffset` — the absolute caret offset (within the joined text of
 *    the editor's text-nodes) where the `@` was typed. Used to slice the
 *    query as the caret moves.
 *  - `query` — substring after the `@` up to the caret
 *  - `activeIndex` — keyboard-highlighted row in the picker
 *
 * Selection commit:
 *  - Removes the typed `@query` text from the editor
 *  - Calls `SmartTextarea.insertChip(...)` (the imperative API from Phase 3.2)
 *  - Closes the picker, refocuses the editor, places caret after the chip
 *
 * Why direct DOM listeners (not React handlers): React props on the editor
 * already wire `onInput` / `onKeyDown` for the textarea's own concerns. We
 * intercept at the same layer via `addEventListener` so the order is
 * deterministic and we can call `preventDefault` on Enter without racing
 * SmartTextarea's own onSubmit.
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
import type { MentionPickerNiche } from '../partials/MentionPicker';
import { getCursorRect } from '../utils/cursorRect';

/**
 * Returns the absolute caret offset measured against the editor's joined
 * plain text (chip elements count as 0 chars — they're atomic and not part
 * of the @-token area). Returns null if there is no caret in the editor.
 */
const getCaretOffset = (root: HTMLElement): number | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;

  const preCaret = document.createRange();
  preCaret.selectNodeContents(root);
  preCaret.setEnd(range.startContainer, range.startOffset);

  // toString skips inline element text? Actually, toString on a Range returns
  // ALL text content including nested elements. We want chip text to count
  // as ZERO so the `@` substring math stays consistent. Walk manually.
  const fragment = preCaret.cloneContents();
  let count = 0;
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      count += node.nodeValue?.length ?? 0;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.dataset?.nicheChip !== undefined) return; // atomic, ignore
    if (el.tagName === 'BR') {
      count += 1;
      return;
    }
    el.childNodes.forEach(walk);
  };
  fragment.childNodes.forEach(walk);
  return count;
};

/**
 * Returns the editor's joined plain text (chip text excluded).
 */
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

/**
 * Locates the text node + offset corresponding to a given absolute caret
 * offset (matching getCaretOffset above). Returns null if not found.
 */
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
        // BR contributes 1; place caret just after the br.
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

const TERMINATE_CHARS = new Set([' ', '\t', '\n']);

export interface UseMentionTriggerArgs {
  smartTextareaRef: RefObject<SmartTextareaHandle | null>;
  niches: MentionPickerNiche[];
  isLoading: boolean;
  /**
   * Called when user clicks the "+ Neue Nische erstellen" CTA in the empty
   * state. Parent decides what to do (typically open NicheCreate modal).
   */
  onCreateNicheRequested: () => void;
}

export interface MentionPickerProps {
  open: boolean;
  anchorRect: DOMRect | null;
  query: string;
  activeIndex: number;
  niches: MentionPickerNiche[];
  isLoading: boolean;
  onSelect: (niche: MentionPickerNiche) => void;
  onClose: () => void;
  onCreateNiche: () => void;
  onHoverIndex: (idx: number) => void;
}

export interface UseMentionTriggerReturn {
  pickerProps: MentionPickerProps;
}

const MAX_VISIBLE = 8;

const filterNiches = (
  list: MentionPickerNiche[],
  query: string,
): MentionPickerNiche[] => {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, MAX_VISIBLE);
  return list
    .filter((n) => {
      const name = n.name.toLowerCase();
      const slug = (n.slug ?? '').toLowerCase();
      return name.includes(q) || slug.includes(q);
    })
    .slice(0, MAX_VISIBLE);
};

export const useMentionTrigger = ({
  smartTextareaRef,
  niches,
  isLoading,
  onCreateNicheRequested,
}: UseMentionTriggerArgs): UseMentionTriggerReturn => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // We track the caret offset where `@` was typed. This is updated on open
  // and read on every input/keydown event to recompute the query slice.
  const triggerOffsetRef = useRef<number | null>(null);

  // Filtered list — derived for picker AND for keyboard navigation. We need
  // a ref so the keydown listener (which has stale closure of `niches`)
  // always sees the current filtered list.
  const filtered = useMemo(
    () => filterNiches(niches, query),
    [niches, query],
  );
  const filteredRef = useRef(filtered);
  // Sync ref in an effect — assigning during render is flagged by the
  // react-hooks/refs lint rule because it can cause stale renders.
  useEffect(() => {
    filteredRef.current = filtered;
  }, [filtered]);

  const closePicker = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
    setAnchorRect(null);
    triggerOffsetRef.current = null;
  }, []);

  // Re-evaluate query based on current caret position vs trigger offset.
  // Returns true if picker should remain open, false if it should close.
  const reevaluateQuery = useCallback(
    (root: HTMLElement): boolean => {
      const triggerOffset = triggerOffsetRef.current;
      if (triggerOffset === null) return false;
      const caret = getCaretOffset(root);
      if (caret === null || caret < triggerOffset) {
        return false;
      }
      const text = getEditorText(root);
      // The character at index `triggerOffset - 1` should still be `@` —
      // if the user deleted it, close.
      if (text[triggerOffset - 1] !== '@') {
        return false;
      }
      const slice = text.slice(triggerOffset, caret);
      // If the slice contains a terminator, close.
      for (const ch of slice) {
        if (TERMINATE_CHARS.has(ch)) {
          return false;
        }
      }
      setQuery(slice);
      // Update anchor rect to follow caret.
      const rect = getCursorRect(root);
      if (rect) setAnchorRect(rect);
      return true;
    },
    [],
  );

  const commitSelection = useCallback(
    (niche: MentionPickerNiche) => {
      const handle = smartTextareaRef.current;
      const root = handle?.getEditableElement();
      const triggerOffset = triggerOffsetRef.current;
      if (!handle || !root || triggerOffset === null) {
        // Defensive — still try to insert the chip.
        handle?.insertChip({ niche_id: niche.id, niche_name: niche.name });
        closePicker();
        return;
      }

      // Remove the `@query` substring — from `triggerOffset - 1` (the @)
      // to `triggerOffset + query.length` (current caret).
      const start = triggerOffset - 1;
      const end = triggerOffset + query.length;

      const startNode = findTextNodeAtOffset(root, start);
      const endNode = findTextNodeAtOffset(root, end);

      try {
        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode.node, startNode.offset);
          range.setEnd(endNode.node, endNode.offset);
          range.deleteContents();
          // Place caret at the deletion point so insertChip drops the chip
          // in the right place.
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        }
      } catch {
        // If range manipulation fails, fall through to insertChip anyway.
      }

      handle.insertChip({ niche_id: niche.id, niche_name: niche.name });
      handle.focus();
      closePicker();
    },
    [smartTextareaRef, query, closePicker],
  );

  const onSelect = useCallback(
    (niche: MentionPickerNiche) => {
      commitSelection(niche);
    },
    [commitSelection],
  );

  const onHoverIndex = useCallback((idx: number) => setActiveIndex(idx), []);

  // Wire DOM listeners on the editable root.
  useEffect(() => {
    const handle = smartTextareaRef.current;
    const root = handle?.getEditableElement();
    if (!root) return;

    const onKeyDown = (event: KeyboardEvent) => {
      // Open trigger: literal `@` keystroke
      if (event.key === '@' && !event.ctrlKey && !event.metaKey) {
        // Defer one tick so the `@` is actually inserted before we measure.
        // We capture the rect AFTER the keypress lands.
        requestAnimationFrame(() => {
          const r = handle?.getEditableElement();
          if (!r) return;
          const caret = getCaretOffset(r);
          if (caret === null) return;
          // The `@` we just typed is at caret-1. The query starts at caret.
          triggerOffsetRef.current = caret;
          const rect = getCursorRect(r);
          if (rect) setAnchorRect(rect);
          setQuery('');
          setActiveIndex(0);
          setOpen(true);
        });
        return; // let the @ char land normally
      }

      if (!open) return;

      // OPEN-state navigation
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
          // SmartTextarea's onSubmit also reacts to Enter — preventDefault
          // here happens BEFORE React's synthetic Enter handler because we
          // attached as a native capture-phase listener (see below).
          event.stopPropagation();
          commitSelection(list[Math.min(activeIndex, list.length - 1)]);
          return;
        }
        // No results -> let normal Enter behaviour through (close + submit)
        closePicker();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closePicker();
        return;
      }
      if (event.key === ' ' || event.key === 'Tab') {
        // Space terminates the @-token
        closePicker();
        return;
      }
      // Backspace handled in onInput re-evaluation (it also covers
      // letter typing via the normal input event).
    };

    const onInput = () => {
      if (!open) return;
      const r = handle?.getEditableElement();
      if (!r) return;
      const stillOpen = reevaluateQuery(r);
      if (!stillOpen) {
        closePicker();
      } else {
        // Reset active index when the result list changes.
        setActiveIndex(0);
      }
    };

    const onBlur = (event: FocusEvent) => {
      if (!open) return;
      // Only close if focus is leaving to something OTHER than the picker.
      const next = event.relatedTarget as HTMLElement | null;
      if (next?.closest('[data-testid="mention-picker"]')) {
        return;
      }
      // Small delay so a click on a picker row can fire its handler before
      // we tear the picker down.
      window.setTimeout(() => {
        const active = document.activeElement as HTMLElement | null;
        if (active?.closest('[data-testid="mention-picker"]')) return;
        closePicker();
      }, 120);
    };

    // Attach on capture phase for keydown so we beat React's synthetic
    // handlers (preventing Enter from triggering form submit).
    root.addEventListener('keydown', onKeyDown, true);
    root.addEventListener('input', onInput);
    root.addEventListener('blur', onBlur);

    return () => {
      root.removeEventListener('keydown', onKeyDown, true);
      root.removeEventListener('input', onInput);
      root.removeEventListener('blur', onBlur);
    };
    // commitSelection / closePicker / reevaluateQuery captured via refs above.
  }, [
    smartTextareaRef,
    open,
    activeIndex,
    closePicker,
    commitSelection,
    reevaluateQuery,
  ]);

  // Handle the special case where the `@` was typed at the very start of an
  // empty editor: the rAF measurement happens before React has reflowed, so
  // anchorRect can be null. The picker handles null gracefully (renders at
  // root corner).
  const pickerProps: MentionPickerProps = {
    open,
    anchorRect,
    query,
    activeIndex,
    niches: filtered,
    isLoading,
    onSelect,
    onClose: closePicker,
    onCreateNiche: () => {
      onCreateNicheRequested();
      closePicker();
    },
    onHoverIndex,
  };

  return { pickerProps };
};
