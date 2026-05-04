import { Fragment, type ReactNode } from 'react';
import type { SourceItem } from '@/types/search';
import { parseCitations, unescapeCitationBrackets } from './parseCitations';
import CitationLink from './CitationLink';

/**
 * PROJ-20 Phase 4.1 — Citation post-processor (AC-25 → AC-29 + EC-5/6/11/12).
 *
 * Given the streamed Markdown-rendered text + the message's source list, this
 * helper walks every text leaf and replaces `[N]` tokens with clickable
 * `<sup><a>` citation links — but ONLY when N <= sources.length (AC-28). For
 * hallucinated indices (`N > sources.length`) the original `[N]` text stays
 * verbatim so the bad LLM output remains visible (AC-28).
 *
 * Usage: provide the helper as a `react-markdown` overrides bundle:
 *
 * ```tsx
 *   <Markdown components={createCitationComponents(sources, messageId)}>
 *     {content}
 *   </Markdown>
 * ```
 *
 * The hook for each text leaf is the `text`-component override in
 * `react-markdown` v10 + (which exposes raw text as a renderable component).
 */

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * Walk a string -> mixed array of text + <CitationLink> elements.
 * Also unescapes `\[5\]` -> `[5]` so the user sees the canonical form.
 */
export const processCitationsInText = (
  text: string,
  sources: SourceItem[],
  messageId: string,
): ReactNode[] => {
  const segments = parseCitations(text);
  const totalSources = sources.length;
  return segments.map((seg, i) => {
    if (seg.type === 'text') {
      return <Fragment key={i}>{unescapeCitationBrackets(seg.value)}</Fragment>;
    }
    // AC-28: hallucination guard
    if (seg.index < 1 || seg.index > totalSources) {
      return <Fragment key={i}>[{seg.index}]</Fragment>;
    }
    const src = sources[seg.index - 1];
    return (
      <CitationLink
        key={i}
        index={seg.index}
        domain={getDomain(src.url)}
        messageId={messageId}
      />
    );
  });
};

/**
 * Builds a `react-markdown` `components` overrides bundle that handles citations.
 *
 * `react-markdown` v10 exposes overridable element components (p, a, code,
 * pre, table, etc.). For citation-in-text we hook into the renderers that
 * receive raw children and post-process those children's strings.
 *
 * Note: we cannot override the `text` HAST node directly (react-markdown v10
 * doesn't expose `text` component override unless we write a rehype plugin),
 * so we pass children through a Children.map walker inside paragraph + heading
 * + list-item + emphasis + strong + table-cell renderers.
 */
export const walkChildrenForCitations = (
  children: ReactNode,
  sources: SourceItem[],
  messageId: string,
): ReactNode => {
  if (children == null) return children;
  if (typeof children === 'string') {
    return processCitationsInText(children, sources, messageId);
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => {
      if (typeof c === 'string') {
        // wrap with key so React doesn't warn
        return (
          <Fragment key={i}>
            {processCitationsInText(c, sources, messageId)}
          </Fragment>
        );
      }
      return c;
    });
  }
  return children;
};
