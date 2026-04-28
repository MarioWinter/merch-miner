/**
 * PROJ-20 Phase 3.3 — getCursorRect tests
 *
 * jsdom does not implement layout, so `getBoundingClientRect()` returns the
 * empty rect for everything. We assert the contract instead of pixel values:
 *  - returns null when no root passed
 *  - returns a DOMRect (not null) when a root is provided, regardless of
 *    selection state — falls back to root rect
 *  - falls back when selection is outside the root
 */
import { describe, it, expect } from 'vitest';
import { getCursorRect } from '../utils/cursorRect';

describe('getCursorRect (PROJ-20 Phase 3.3)', () => {
  it('returns null when root is null', () => {
    expect(getCursorRect(null)).toBeNull();
  });

  it('returns a DOMRect when root has no selection (falls back to root rect)', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    try {
      // Clear any selection
      window.getSelection()?.removeAllRanges();
      const rect = getCursorRect(root);
      expect(rect).not.toBeNull();
      expect(rect).toBeInstanceOf(DOMRect);
    } finally {
      document.body.removeChild(root);
    }
  });

  it('returns a DOMRect when selection is inside the root (collapsed range)', () => {
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.appendChild(document.createTextNode('hello'));
    document.body.appendChild(root);
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(root.firstChild as Text, 5);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);

      const rect = getCursorRect(root);
      expect(rect).not.toBeNull();
      expect(rect).toBeInstanceOf(DOMRect);
    } finally {
      document.body.removeChild(root);
    }
  });

  it('falls back to root rect when selection is outside the root', () => {
    const root = document.createElement('div');
    const outside = document.createElement('div');
    outside.contentEditable = 'true';
    outside.appendChild(document.createTextNode('elsewhere'));
    document.body.appendChild(root);
    document.body.appendChild(outside);
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.setStart(outside.firstChild as Text, 0);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);

      const rect = getCursorRect(root);
      expect(rect).not.toBeNull();
      expect(rect).toBeInstanceOf(DOMRect);
    } finally {
      document.body.removeChild(root);
      document.body.removeChild(outside);
    }
  });
});
