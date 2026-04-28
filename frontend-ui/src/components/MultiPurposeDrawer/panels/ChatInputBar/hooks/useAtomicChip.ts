/**
 * PROJ-20 Phase 3.2 — atomic chip selection/range helpers.
 *
 * Encapsulates the messy DOM/Selection bits so SmartTextarea stays
 * focused on its imperative API.
 *
 * Returned helpers:
 * - insertChipAtCursor(niche, removeLabel): replaces an existing chip
 *   (only one allowed per AC-14) OR inserts at the current selection
 *   (or at the end of the editor if there is no selection inside it).
 * - removeExistingChip(): true if a chip was removed.
 * - parseValue(): typed `{text, chip}` snapshot of the editor.
 * - handleBackspaceGuard(event): patches Safari's quirky deletion of
 *   atomic blocks when the caret is just to the right of a chip.
 */
import { useCallback, type RefObject } from 'react';
import { buildChipNode } from '../partials/NicheChip';
import { parseChipText, type ParsedChipText } from '../utils/parseChipText';

interface NicheLike {
  niche_id: string;
  niche_name: string;
}

export interface UseAtomicChipReturn {
  insertChipAtCursor: (niche: NicheLike, removeLabel: string) => void;
  removeExistingChip: () => boolean;
  parseValue: () => ParsedChipText;
  handleBackspaceGuard: (event: KeyboardEvent | React.KeyboardEvent) => void;
}

const findChipElement = (root: HTMLElement | null): HTMLElement | null => {
  if (!root) return null;
  return root.querySelector<HTMLElement>('[data-niche-chip]');
};

const placeCaretAfter = (node: Node): void => {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
};

const placeCaretAtEnd = (root: HTMLElement): void => {
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
};

export const useAtomicChip = (
  rootRef: RefObject<HTMLDivElement | null>,
): UseAtomicChipReturn => {
  const removeExistingChip = useCallback((): boolean => {
    const root = rootRef.current;
    const chip = findChipElement(root);
    if (chip && chip.parentNode) {
      chip.parentNode.removeChild(chip);
      return true;
    }
    return false;
  }, [rootRef]);

  const insertChipAtCursor = useCallback(
    (niche: NicheLike, removeLabel: string): void => {
      const root = rootRef.current;
      if (!root) return;

      // AC-14 — only one chip allowed. Replace existing chip in place
      // so the surrounding text isn't disturbed.
      const existing = findChipElement(root);
      const chip = buildChipNode({
        niche_id: niche.niche_id,
        niche_name: niche.niche_name,
        removeLabel,
      });

      if (existing && existing.parentNode) {
        existing.parentNode.replaceChild(chip, existing);
        // Add a trailing space after the new chip if none exists, so the
        // caret has somewhere to sit and the user can keep typing.
        if (!chip.nextSibling || chip.nextSibling.nodeType !== Node.TEXT_NODE) {
          const space = document.createTextNode(' ');
          chip.parentNode.insertBefore(space, chip.nextSibling);
          placeCaretAfter(space);
        } else {
          placeCaretAfter(chip);
        }
        return;
      }

      const sel = window.getSelection();
      let range: Range | null = null;
      if (sel && sel.rangeCount > 0) {
        const candidate = sel.getRangeAt(0);
        // Only honour the active selection if it's actually inside the editor.
        if (root.contains(candidate.startContainer)) {
          range = candidate;
        }
      }

      if (!range) {
        // No usable selection — append to end.
        root.appendChild(chip);
        const space = document.createTextNode(' ');
        root.appendChild(space);
        placeCaretAfter(space);
        return;
      }

      range.deleteContents();
      range.insertNode(chip);
      // Ensure a text node sits after the chip so the caret has a home.
      const after = chip.nextSibling;
      if (!after || after.nodeType !== Node.TEXT_NODE) {
        const space = document.createTextNode(' ');
        chip.parentNode?.insertBefore(space, chip.nextSibling);
        placeCaretAfter(space);
      } else {
        placeCaretAfter(chip);
      }
    },
    [rootRef],
  );

  const parseValue = useCallback((): ParsedChipText => {
    return parseChipText(rootRef.current);
  }, [rootRef]);

  const handleBackspaceGuard = useCallback(
    (event: KeyboardEvent | React.KeyboardEvent): void => {
      if (event.key !== 'Backspace') return;
      const root = rootRef.current;
      if (!root) return;

      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.startContainer)) return;

      // Case A: caret is at offset 0 of a text node and the previous sibling
      // is the chip → Safari sometimes refuses to delete. Force it.
      if (
        range.startContainer.nodeType === Node.TEXT_NODE &&
        range.startOffset === 0
      ) {
        const prev = range.startContainer.previousSibling;
        if (
          prev &&
          prev.nodeType === Node.ELEMENT_NODE &&
          (prev as HTMLElement).dataset?.nicheChip !== undefined
        ) {
          event.preventDefault();
          prev.parentNode?.removeChild(prev);
          return;
        }
      }

      // Case B: caret sits between siblings inside the editor (offset N of
      // an element-level container) and the node immediately before is the chip.
      if (range.startContainer === root) {
        const idx = range.startOffset;
        if (idx > 0) {
          const prev = root.childNodes[idx - 1];
          if (
            prev &&
            prev.nodeType === Node.ELEMENT_NODE &&
            (prev as HTMLElement).dataset?.nicheChip !== undefined
          ) {
            event.preventDefault();
            root.removeChild(prev);
          }
        }
      }
    },
    [rootRef],
  );

  // Helper not exported but kept for completeness if needed later.
  void placeCaretAtEnd;

  return {
    insertChipAtCursor,
    removeExistingChip,
    parseValue,
    handleBackspaceGuard,
  };
};
