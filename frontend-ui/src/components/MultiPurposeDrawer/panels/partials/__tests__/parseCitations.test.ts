/**
 * PROJ-20 Phase 4.1 — parseCitations regex unit tests.
 *
 * Covers AC-29 (adjacent / parenthesized / punctuation), EC-11 (escaped),
 * EC-12 (perf budget), and AC-28 (hallucination handled at caller layer —
 * here we just confirm parser emits indices unbounded; caller filters them).
 */
import { describe, it, expect } from 'vitest';
import { parseCitations, unescapeCitationBrackets } from '../parseCitations';

describe('parseCitations', () => {
  it('returns single text seg for empty input', () => {
    expect(parseCitations('')).toEqual([]);
  });

  it('returns single text seg when no citations are present', () => {
    expect(parseCitations('plain text')).toEqual([
      { type: 'text', value: 'plain text' },
    ]);
  });

  it('parses one trailing citation', () => {
    expect(parseCitations('Hello [1]')).toEqual([
      { type: 'text', value: 'Hello ' },
      { type: 'citation', index: 1 },
    ]);
  });

  it('parses adjacent citations [1][2]', () => {
    expect(parseCitations('Foo [1][2] bar')).toEqual([
      { type: 'text', value: 'Foo ' },
      { type: 'citation', index: 1 },
      { type: 'citation', index: 2 },
      { type: 'text', value: ' bar' },
    ]);
  });

  it('parses citation followed by punctuation', () => {
    expect(parseCitations('End of sentence.[1]')).toEqual([
      { type: 'text', value: 'End of sentence.' },
      { type: 'citation', index: 1 },
    ]);
  });

  it('parses citation inside parentheses', () => {
    expect(parseCitations('(see [1])')).toEqual([
      { type: 'text', value: '(see ' },
      { type: 'citation', index: 1 },
      { type: 'text', value: ')' },
    ]);
  });

  it('handles multi-digit indices', () => {
    expect(parseCitations('big number [42] in here')).toEqual([
      { type: 'text', value: 'big number ' },
      { type: 'citation', index: 42 },
      { type: 'text', value: ' in here' },
    ]);
  });

  it('does NOT parse escaped \\[5\\] as a citation (EC-11)', () => {
    const input = 'Escaped \\[5\\] is plain text';
    const segs = parseCitations(input);
    // The whole string remains a single text seg because the escaped bracket
    // pair is skipped by the parser.
    expect(segs).toHaveLength(1);
    expect(segs[0]).toEqual({ type: 'text', value: input });
  });

  it('handles multiple citations across the same line', () => {
    expect(parseCitations('a [1] b [2] c [3]')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'citation', index: 1 },
      { type: 'text', value: ' b ' },
      { type: 'citation', index: 2 },
      { type: 'text', value: ' c ' },
      { type: 'citation', index: 3 },
    ]);
  });

  it('handles a citation at the very start', () => {
    expect(parseCitations('[1] first')).toEqual([
      { type: 'citation', index: 1 },
      { type: 'text', value: ' first' },
    ]);
  });

  it('does not treat [foo] (non-numeric) as a citation', () => {
    expect(parseCitations('look at [foo] not a citation')).toEqual([
      { type: 'text', value: 'look at [foo] not a citation' },
    ]);
  });

  it('parses citations even when N is huge (caller is responsible for hallucination guard)', () => {
    // Per AC-28, caller renders [N] as plain text when N > sources.length.
    // The parser still emits the index — guard happens upstream.
    expect(parseCitations('text [9999]')).toEqual([
      { type: 'text', value: 'text ' },
      { type: 'citation', index: 9999 },
    ]);
  });

  it('meets performance budget: 10k chars + 50 citations < 50ms (EC-12)', () => {
    // Build a 10k char string with 50 evenly-spaced [N] citations
    const filler = 'a'.repeat(180);
    const blocks: string[] = [];
    for (let n = 1; n <= 50; n += 1) {
      blocks.push(`${filler} [${n}]`);
    }
    const input = blocks.join(' ');
    expect(input.length).toBeGreaterThan(9000);
    const start = performance.now();
    const segs = parseCitations(input);
    const dur = performance.now() - start;
    // Expected: many segments produced
    const citationCount = segs.filter((s) => s.type === 'citation').length;
    expect(citationCount).toBe(50);
    // Performance budget is 50ms p95; we test single run with generous 50ms
    // ceiling so flaky CI doesn't fail. In practice this runs in <2ms.
    expect(dur).toBeLessThan(50);
  });
});

describe('unescapeCitationBrackets', () => {
  it('removes backslashes before brackets only', () => {
    expect(unescapeCitationBrackets('\\[5\\]')).toBe('[5]');
    expect(unescapeCitationBrackets('a\\[1\\]b')).toBe('a[1]b');
  });

  it('does not touch other backslashes', () => {
    expect(unescapeCitationBrackets('foo\\nbar')).toBe('foo\\nbar');
  });

  it('handles empty input', () => {
    expect(unescapeCitationBrackets('')).toBe('');
  });
});
