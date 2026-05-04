/**
 * PROJ-20 Phase 4.1 — Citation parser
 *
 * Walks a plain-text Markdown leaf and splits it into parts where every `[N]`
 * token (1-indexed integer in brackets) becomes a structured citation segment.
 *
 * Edge cases (per AC-29 + EC-11 + AC-28):
 *   - Adjacent citations: `[1][2]` → two separate citation segments, no text between
 *   - Punctuation-trail: `.[1]` → text `.` then citation 1
 *   - Parenthesized: `(...laut [1])` → citation 1 inside parens
 *   - Escaped: `\[5\]` → NOT parsed (rendered as plain `[5]`)
 *   - Hallucinated (N > totalSources): caller renders as plain text per AC-28
 *
 * Performance budget: ≤50ms p95 for 10k char answers with 50 citations (EC-12).
 * The parser uses a single linear regex pass so it is well within budget.
 */
export type CitationSegment =
  | { type: 'text'; value: string }
  | { type: 'citation'; index: number };

const CITATION_RE = /\[(\d+)\]/g;

/**
 * Split a string into text + citation segments.
 *
 * @param input plain text from a Markdown leaf
 * @returns ordered segment list — never empty when input is non-empty
 */
export const parseCitations = (input: string): CitationSegment[] => {
  if (!input) return [];

  const out: CitationSegment[] = [];
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  // Reset regex state (it's stateful with /g flag).
  CITATION_RE.lastIndex = 0;

  while ((match = CITATION_RE.exec(input)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    // Escape semantics: if preceded by an odd number of backslashes the bracket
    // pair is escaped → treat as literal text. We need to count contiguous
    // backslashes BEFORE the `[`.
    let backslashes = 0;
    for (let i = start - 1; i >= 0 && input[i] === '\\'; i -= 1) backslashes += 1;
    if (backslashes % 2 === 1) {
      // Escaped — skip without splitting.
      continue;
    }

    // Emit any text accumulated before this citation.
    if (start > lastEnd) {
      out.push({ type: 'text', value: input.slice(lastEnd, start) });
    }

    out.push({ type: 'citation', index: parseInt(match[1], 10) });
    lastEnd = end;
  }

  // Trailing text after the last citation.
  if (lastEnd < input.length) {
    out.push({ type: 'text', value: input.slice(lastEnd) });
  }

  // If no citations found at all, return the whole string as a single text seg.
  if (out.length === 0) {
    out.push({ type: 'text', value: input });
  }

  return out;
};

/**
 * Removes `\[5\]` style escape backslashes from a text segment so the user
 * sees `[5]` (not `\[5\]`) in the rendered output.
 */
export const unescapeCitationBrackets = (s: string): string =>
  s.replace(/\\(\[|\])/g, '$1');
