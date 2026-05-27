/**
 * FIX-ai-research-like-and-notes-editor — Phase 4C
 *
 * Enter-continuation for list-style line prefixes. When the user presses
 * `Enter` on a line that starts with `- `, `- [ ] `, `- [x] `, or `N. `:
 *   - If the line content AFTER the prefix is non-empty → insert a fresh
 *     newline + same prefix (numbered list auto-increments) (AC-B11).
 *   - If the line content is empty (cursor at prefix end) → remove the
 *     prefix and insert a plain newline (escape pattern, AC-B12 / EC-B4).
 *
 * Disabled while the slash-menu is open so Enter routes to the menu instead.
 */
import { useEffect, type RefObject } from 'react';

export interface UseListContinuationArgs {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  enabled: boolean;
}

const LIST_PREFIX_REGEX = /^(-\s\[[ x]\]\s|-\s|(\d+)\.\s)/;

interface ContinuationMatch {
  prefix: string;
  /** Continuation prefix (numbered = N+1; others identical). */
  continuationPrefix: string;
}

const matchContinuation = (linePrefix: string): ContinuationMatch | null => {
  const m = linePrefix.match(LIST_PREFIX_REGEX);
  if (!m) return null;
  const matched = m[0];
  if (matched !== linePrefix) {
    // Strict match — the entire line content before the caret must BE the
    // prefix (we only auto-continue when the user is right after the prefix
    // OR has content typed in the same line). We accept BOTH: continuation
    // fires whenever the line STARTS with a prefix. Caller decides escape
    // (empty) vs continuation (non-empty).
  }
  // Numbered list → increment.
  const numMatch = matched.match(/^(\d+)\.\s$/);
  if (numMatch) {
    const next = Number(numMatch[1]) + 1;
    return { prefix: matched, continuationPrefix: `${next}. ` };
  }
  // For to-do, always continue as an unchecked `- [ ] ` even if current line
  // is `- [x] ` (user expects new task starts unchecked).
  if (matched.startsWith('- [')) {
    return { prefix: matched, continuationPrefix: '- [ ] ' };
  }
  return { prefix: matched, continuationPrefix: matched };
};

export const useListContinuation = ({
  textareaRef,
  value,
  onChange,
  enabled,
}: UseListContinuationArgs): void => {
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;
      if (event.key !== 'Enter') return;
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const caret = el.selectionEnd;
      // Only act when selection is a caret, not a range.
      if (el.selectionStart !== el.selectionEnd) return;

      const lineStart = value.lastIndexOf('\n', caret - 1) + 1;
      const linePrefixSlice = value.slice(lineStart, caret);
      const match = matchContinuation(linePrefixSlice);
      if (!match) return;

      // Determine if the line content after the prefix on the FULL line is
      // empty (escape) vs non-empty (continue). We look at the whole current
      // line, not just up-to-caret, so that a cursor parked at the end of a
      // non-empty bullet still continues — and a cursor on a literal `- `
      // empty bullet still escapes.
      const lineEnd = value.indexOf('\n', caret);
      const fullLine = value.slice(
        lineStart,
        lineEnd === -1 ? value.length : lineEnd,
      );
      const restOfLine = fullLine.slice(match.prefix.length);

      event.preventDefault();
      if (restOfLine.length === 0) {
        // Escape: remove the prefix, replace with plain newline.
        const before = value.slice(0, lineStart);
        const after = value.slice(caret);
        const newText = before + after;
        const newCaret = lineStart;
        onChange(newText);
        // Restore caret on next frame after React commits.
        requestAnimationFrame(() => {
          try {
            el.setSelectionRange(newCaret, newCaret);
          } catch {
            // ignore
          }
        });
        return;
      }

      // Continuation: insert `\n` + new prefix at caret.
      const insertion = '\n' + match.continuationPrefix;
      const before = value.slice(0, caret);
      const after = value.slice(caret);
      const newText = before + insertion + after;
      const newCaret = caret + insertion.length;
      onChange(newText);
      requestAnimationFrame(() => {
        try {
          el.setSelectionRange(newCaret, newCaret);
        } catch {
          // ignore
        }
      });
    };

    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [textareaRef, value, onChange, enabled]);
};
