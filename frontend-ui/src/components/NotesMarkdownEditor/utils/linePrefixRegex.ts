/**
 * FIX-ai-research-like-and-notes-editor — Phase 4A
 *
 * Detects any pre-existing markdown line-prefix at the start of a line so
 * we can REPLACE it (EC-B13) when the user picks a different line-prefix
 * command from the slash menu.
 *
 * Covers:
 *   - `# ` to `###### ` (headings)
 *   - `- [ ] ` / `- [x] ` (to-do)
 *   - `- ` (bulleted list)
 *   - `N. ` (numbered list, any number of digits)
 *   - `> ` (quote / callout body)
 */
export const LINE_PREFIX_REGEX = /^(#{1,6}\s|-\s\[[ x]\]\s|-\s|\d+\.\s|>\s)/;

/**
 * Returns the length of the existing line-prefix on the line that starts at
 * `lineStart` in `text`, or `0` if no recognised prefix is present.
 */
export const matchExistingPrefix = (text: string, lineStart: number): number => {
  const slice = text.slice(lineStart);
  const match = slice.match(LINE_PREFIX_REGEX);
  return match ? match[0].length : 0;
};
