/**
 * PROJ-20 Phase 3.2 — parse a SmartTextarea contenteditable root into
 * a plain `{ text, chip }` value.
 *
 * Walks the root's child nodes once:
 * - TEXT_NODE → append nodeValue to text accumulator
 * - ELEMENT[data-niche-chip] → capture chip data (FIRST chip wins, AC-14 defensive)
 * - ELEMENT <br> → append `\n`
 * - other ELEMENT → recurse into children (defensive against unexpected wrappers)
 *
 * The trailing/leading whitespace is trimmed off the final text, but
 * internal whitespace and newlines are preserved verbatim.
 */
export interface ParsedChip {
  niche_id: string;
  niche_name: string;
}

export interface ParsedChipText {
  text: string;
  chip: ParsedChip | null;
}

const isChipElement = (el: Element): boolean =>
  el instanceof HTMLElement && el.dataset.nicheChip !== undefined;

export const parseChipText = (root: HTMLElement | null): ParsedChipText => {
  if (!root) {
    return { text: '', chip: null };
  }

  let text = '';
  let chip: ParsedChip | null = null;

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.nodeValue ?? '';
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }

    const el = node as Element;

    if (isChipElement(el)) {
      const htmlEl = el as HTMLElement;
      // First chip wins — defensive in case someone slips a second chip in.
      if (chip === null) {
        chip = {
          niche_id: htmlEl.dataset.nicheId ?? '',
          niche_name: htmlEl.dataset.nicheName ?? '',
        };
      }
      return;
    }

    if (el.tagName === 'BR') {
      text += '\n';
      return;
    }

    el.childNodes.forEach((child) => walk(child));
  };

  root.childNodes.forEach((child) => walk(child));

  return {
    text: text.trim(),
    chip,
  };
};
