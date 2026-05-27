/**
 * FIX-ai-research-like-and-notes-editor — Phase 4A
 *
 * Three pure insertion strategies for the slash-menu commit step.
 *
 * Shared input semantics:
 *   - `text`          — full textarea value
 *   - `triggerOffset` — 0-based index of the `/` character
 *   - `caret`         — current `selectionEnd` (end of `/query`)
 *
 * Every strategy:
 *   1. Strips `text.slice(triggerOffset, caret)` (the `/query` substring).
 *   2. Inserts the command payload per its rules.
 *   3. Returns `{ newText, newSelectionStart, newSelectionEnd }`.
 */
import { matchExistingPrefix } from './linePrefixRegex';

export interface InsertionResult {
  newText: string;
  newSelectionStart: number;
  newSelectionEnd: number;
}

/**
 * Line-prefix command — prepends `prefix` to the start of the current line,
 * replacing any existing recognised line-prefix (EC-B13). The `/query` is
 * stripped first; content on the same line either side of the trigger is
 * preserved.
 *
 * Caret lands at lineStart + prefix.length.
 */
export const applyLinePrefix = (
  text: string,
  triggerOffset: number,
  caret: number,
  prefix: string,
): InsertionResult => {
  // 1. Strip `/query`.
  const stripped = text.slice(0, triggerOffset) + text.slice(caret);

  // 2. Find line start. `triggerOffset` survives intact because the stripped
  //    range starts AT triggerOffset, so anything before it is unchanged.
  const lineStart = stripped.lastIndexOf('\n', triggerOffset - 1) + 1;

  // 3. Detect any existing prefix at line start → replace, otherwise prepend.
  const existingLen = matchExistingPrefix(stripped, lineStart);

  const before = stripped.slice(0, lineStart);
  const after = stripped.slice(lineStart + existingLen);
  const newText = before + prefix + after;
  const newCaret = lineStart + prefix.length;
  return { newText, newSelectionStart: newCaret, newSelectionEnd: newCaret };
};

/**
 * Block command — inserts a multi-line block at the trigger position.
 * If the line has non-whitespace content before the trigger AND we're not at
 * line-start, prepend a leading newline so the block starts fresh (EC-B12).
 *
 * Caret lands at `triggerOffset + leadingNewlineLen + caretOffsetFromInsertStart`
 * (or end of insertion when undefined).
 */
export const applyBlock = (
  text: string,
  triggerOffset: number,
  caret: number,
  block: string,
  caretOffsetFromInsertStart?: number,
): InsertionResult => {
  const stripped = text.slice(0, triggerOffset) + text.slice(caret);

  // Check whether trigger sits at line-start (prev char is `\n` or undefined).
  const prevChar = triggerOffset > 0 ? stripped[triggerOffset - 1] : undefined;
  const needsLeadingNewline = prevChar !== undefined && prevChar !== '\n';
  const leading = needsLeadingNewline ? '\n' : '';

  const insertion = leading + block;
  const before = stripped.slice(0, triggerOffset);
  const after = stripped.slice(triggerOffset);
  const newText = before + insertion + after;

  const insertStart = triggerOffset + leading.length;
  const caretOffset =
    caretOffsetFromInsertStart !== undefined
      ? caretOffsetFromInsertStart
      : block.length;
  const newCaret = insertStart + caretOffset;
  return { newText, newSelectionStart: newCaret, newSelectionEnd: newCaret };
};

interface ApplyInlineOpts {
  caretOffsetFromInsertStart?: number;
  selectionStart?: number;
  selectionEnd?: number;
}

/**
 * Inline template — inserts a wrapper/template at the trigger position.
 * Caret/selection per command:
 *   - selectionStart+selectionEnd set → highlight that substring (Link `url`)
 *   - caretOffsetFromInsertStart set  → caret at that offset (Bold middle)
 *   - neither                         → caret at end of insertion
 */
export const applyInline = (
  text: string,
  triggerOffset: number,
  caret: number,
  template: string,
  opts: ApplyInlineOpts = {},
): InsertionResult => {
  const stripped = text.slice(0, triggerOffset) + text.slice(caret);
  const before = stripped.slice(0, triggerOffset);
  const after = stripped.slice(triggerOffset);
  const newText = before + template + after;

  if (opts.selectionStart !== undefined && opts.selectionEnd !== undefined) {
    return {
      newText,
      newSelectionStart: triggerOffset + opts.selectionStart,
      newSelectionEnd: triggerOffset + opts.selectionEnd,
    };
  }
  const caretOffset =
    opts.caretOffsetFromInsertStart !== undefined
      ? opts.caretOffsetFromInsertStart
      : template.length;
  const newCaret = triggerOffset + caretOffset;
  return { newText, newSelectionStart: newCaret, newSelectionEnd: newCaret };
};
