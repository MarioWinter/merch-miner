/**
 * FIX-ai-research-like-and-notes-editor — Phase 4A
 *
 * Table-driven unit tests for the three slash-menu insertion strategies.
 * Covers AC-B6 / AC-B9 (line-prefix), EC-B12 (block mid-line), EC-B13 (replace
 * existing prefix), EC-B14 (inline link selection).
 */
import { describe, expect, it } from 'vitest';
import {
  applyBlock,
  applyInline,
  applyLinePrefix,
} from '../insertionStrategies';

describe('applyLinePrefix', () => {
  it('inserts `- ` on an empty line and caret lands at end of prefix', () => {
    // text after `/` typed at start of empty textarea: '/'
    const result = applyLinePrefix('/', 0, 1, '- ');
    expect(result.newText).toBe('- ');
    expect(result.newSelectionStart).toBe(2);
    expect(result.newSelectionEnd).toBe(2);
  });

  it('inserts `- ` at line-start when the line already has leading content', () => {
    // user typed `/bu` at end of `Hello ` → text = 'Hello /bu'
    const result = applyLinePrefix('Hello /bu', 6, 9, '- ');
    expect(result.newText).toBe('- Hello ');
    expect(result.newSelectionStart).toBe(2);
  });

  it('replaces an existing `- ` prefix when running Heading 1 on a bulleted line', () => {
    // line is '- existing', cursor after 'existing', user types `/h` → '- existing/h'
    const result = applyLinePrefix('- existing/h', 10, 12, '# ');
    expect(result.newText).toBe('# existing');
    expect(result.newSelectionStart).toBe(2);
  });

  it('replaces an existing `1. ` prefix when running Bulleted list on a numbered line', () => {
    const result = applyLinePrefix('1. existing/b', 11, 13, '- ');
    expect(result.newText).toBe('- existing');
    expect(result.newSelectionStart).toBe(2);
  });

  it('replaces an existing `- [ ] ` prefix when running Quote', () => {
    const result = applyLinePrefix('- [ ] task/q', 10, 12, '> ');
    expect(result.newText).toBe('> task');
    expect(result.newSelectionStart).toBe(2);
  });

  it('preserves prior lines and only operates on the current line', () => {
    // Two lines, cursor on second line typing `/b`.
    const text = 'first line\nsecond/b';
    // triggerOffset = 17 (`/`), caret = 19
    const result = applyLinePrefix(text, 17, 19, '- ');
    expect(result.newText).toBe('first line\n- second');
    // lineStart = 11 (after the `\n`), caret = 11 + 2 = 13
    expect(result.newSelectionStart).toBe(13);
  });
});

describe('applyBlock', () => {
  it('inserts a code block at start of empty textarea without leading newline', () => {
    const block = '```\n\n```';
    const result = applyBlock('/', 0, 1, block, 4);
    expect(result.newText).toBe('```\n\n```');
    // caret on the empty middle line
    expect(result.newSelectionStart).toBe(4);
  });

  it('prepends a leading newline when the trigger sits mid-line (EC-B12)', () => {
    // text: 'hello/' triggerOffset=5, caret=6
    const block = '```\n\n```';
    const result = applyBlock('hello/', 5, 6, block, 4);
    expect(result.newText).toBe('hello\n```\n\n```');
    // insertStart = 5 + 1 (leading `\n`) = 6 → caret 6 + 4 = 10
    expect(result.newSelectionStart).toBe(10);
  });

  it('inserts a divider with no caret-offset → caret at end of insertion', () => {
    const result = applyBlock('/', 0, 1, '---\n');
    expect(result.newText).toBe('---\n');
    expect(result.newSelectionStart).toBe(4);
  });

  it('inserts a Note callout block; caret at end (after `> `)', () => {
    const block = '> [!NOTE]\n> ';
    const result = applyBlock('/', 0, 1, block);
    expect(result.newText).toBe('> [!NOTE]\n> ');
    expect(result.newSelectionStart).toBe(block.length);
  });

  it('keeps trailing content on the next line after the block', () => {
    // text: 'before/after' → triggerOffset=6, caret=7
    const block = '---\n';
    const result = applyBlock('before/after', 6, 7, block);
    // leading newline prepended; final text: 'before\n---\nafter'
    expect(result.newText).toBe('before\n---\nafter');
    // insertStart = 6 + 1 = 7, caret at insertStart + block.length = 7 + 4 = 11
    expect(result.newSelectionStart).toBe(11);
  });
});

describe('applyInline', () => {
  it('inserts `****` and caret lands between the two pairs (Bold)', () => {
    const result = applyInline('/', 0, 1, '****', {
      caretOffsetFromInsertStart: 2,
    });
    expect(result.newText).toBe('****');
    expect(result.newSelectionStart).toBe(2);
    expect(result.newSelectionEnd).toBe(2);
  });

  it('inserts `[text](url)` and selects the `url` substring (EC-B14)', () => {
    const result = applyInline('/', 0, 1, '[text](url)', {
      selectionStart: 7,
      selectionEnd: 10,
    });
    expect(result.newText).toBe('[text](url)');
    // `[text](url)` — indices: [=0 t=1 e=2 x=3 t=4 ]=5 (=6 u=7 r=8 l=9 )=10
    expect(result.newSelectionStart).toBe(7);
    expect(result.newSelectionEnd).toBe(10);
    expect(result.newText.slice(7, 10)).toBe('url');
  });

  it('inserts inline template mid-line, no leading newline, no replacement', () => {
    const result = applyInline('hello /b', 6, 8, '****', {
      caretOffsetFromInsertStart: 2,
    });
    expect(result.newText).toBe('hello ****');
    expect(result.newSelectionStart).toBe(8);
  });
});
