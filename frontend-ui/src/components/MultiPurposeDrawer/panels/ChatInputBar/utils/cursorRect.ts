/**
 * PROJ-20 Phase 3.3 — cursor rect helper.
 *
 * Returns the bounding rect of the current selection's start point. This is
 * used by `useMentionTrigger` to anchor a Floating-UI dropdown to the caret.
 *
 * Why a dedicated helper: `Range.getBoundingClientRect()` returns a 0-sized
 * rect for collapsed ranges in some browsers and the empty rect (0/0/0/0) at
 * the start of an empty contenteditable. We normalize those edge cases to a
 * usable rect derived from the root element so the picker still renders.
 */
export const getCursorRect = (rootEl: HTMLElement | null): DOMRect | null => {
  if (!rootEl) return null;

  const sel = typeof window !== 'undefined' ? window.getSelection() : null;

  // No selection at all — fall back to the top-left corner of the root so the
  // picker still appears (e.g. user just typed `@` programmatically).
  if (!sel || sel.rangeCount === 0) {
    return rootRectAsCaret(rootEl);
  }

  const range = sel.getRangeAt(0);
  if (!rootEl.contains(range.startContainer)) {
    return rootRectAsCaret(rootEl);
  }

  // For collapsed ranges, getClientRects() returns nothing in some browsers
  // (notably WebKit). Insert a zero-width marker, measure, then remove it.
  // This is the standard "hidden span trick" that contenteditable libs use.
  const cloned = range.cloneRange();
  cloned.collapse(true);
  let rect = cloned.getBoundingClientRect();

  if (isEmptyRect(rect)) {
    const marker = document.createElement('span');
    // Zero-width-space keeps the marker invisible but measurable.
    marker.textContent = '​';
    try {
      cloned.insertNode(marker);
      rect = marker.getBoundingClientRect();
    } finally {
      marker.parentNode?.removeChild(marker);
      // Re-collapse the original selection so we don't leak any state.
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }

  if (isEmptyRect(rect)) {
    return rootRectAsCaret(rootEl);
  }

  return rect;
};

const isEmptyRect = (rect: DOMRect): boolean =>
  rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0;

const rootRectAsCaret = (rootEl: HTMLElement): DOMRect => {
  const r = rootEl.getBoundingClientRect();
  // Approximate caret rect at the top-left of the root, with the line height
  // taken from the rendered element so the picker doesn't overlap the input.
  const lineHeight = parseFloat(
    window.getComputedStyle(rootEl).lineHeight || '20',
  );
  const height = Number.isFinite(lineHeight) && lineHeight > 0 ? lineHeight : 20;
  return new DOMRect(r.left + 4, r.top + 4, 0, height);
};
