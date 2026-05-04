import { type ReactNode } from 'react';
import { Box } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import type { SourceItem } from '@/types/search';
import { walkChildrenForCitations } from './CitationProcessor';
import CodeBlock from './CodeBlock';

interface MarkdownAnswerProps {
  /** Raw Markdown content streamed from the backend. */
  content: string;
  /** Source list used to validate `[N]` citation indices. */
  sources: SourceItem[];
  /** Stable id used to scope citation -> SourceCard lookup per AC + EC-5. */
  messageId: string;
}

/**
 * PROJ-20 Phase 4 — production-grade Markdown renderer for AI answers.
 *
 * Features:
 *   - GFM tables, lists, headings, links (target=_blank, rel=noopener)
 *   - Fenced code blocks with `react-syntax-highlighter` (vsc-dark-plus),
 *     language label, and copy-button (AC-35 / AC-36)
 *   - Tables wrap in horizontal-scroll container (AC-37)
 *   - Citation `[N]` post-processing (AC-25 → AC-29)
 *   - `rehype-slug` is intentionally NOT used (AC-38)
 */

// ---- Inline-styled wrappers ----------------------------------------------

const Root = styled(Box)(({ theme }) => ({
  fontSize: '0.875rem',
  lineHeight: 1.55,
  wordBreak: 'break-word',
  color: theme.vars.palette.text.primary,
  '& > *:first-of-type': { marginTop: 0 },
  '& > *:last-child': { marginBottom: 0 },
  '& p': { margin: `${theme.spacing(0.5)} 0` },
  '& a': { color: theme.vars.palette.secondary.main, textDecoration: 'underline' },
  '& ul, & ol': {
    paddingLeft: theme.spacing(2.5),
    margin: `${theme.spacing(0.5)} 0`,
  },
  '& li': { marginBottom: theme.spacing(0.25) },
  '& h1': { fontSize: '1.25rem', fontWeight: 700, margin: `${theme.spacing(1.25)} 0 ${theme.spacing(0.5)}` },
  '& h2': { fontSize: '1.125rem', fontWeight: 700, margin: `${theme.spacing(1.25)} 0 ${theme.spacing(0.5)}` },
  '& h3': { fontSize: '1rem', fontWeight: 600, margin: `${theme.spacing(1)} 0 ${theme.spacing(0.5)}` },
  '& h4': { fontSize: '0.9375rem', fontWeight: 600, margin: `${theme.spacing(1)} 0 ${theme.spacing(0.5)}` },
  '& blockquote': {
    margin: `${theme.spacing(0.5)} 0`,
    padding: `${theme.spacing(0.25)} ${theme.spacing(1.5)}`,
    borderLeft: `3px solid ${theme.vars.palette.divider}`,
    color: theme.vars.palette.text.secondary,
  },
  '& hr': {
    border: 0,
    borderTop: `1px solid ${theme.vars.palette.divider}`,
    margin: `${theme.spacing(1.5)} 0`,
  },
}));

// AC-37: tables overflow inside the bubble, NOT page-wide.
const TableScroll = styled(Box)(({ theme }) => ({
  maxWidth: '100%',
  overflowX: 'auto',
  margin: `${theme.spacing(1)} 0`,
  '& table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.8125rem',
  },
  '& th, & td': {
    border: `1px solid ${theme.vars.palette.divider}`,
    padding: `${theme.spacing(0.5)} ${theme.spacing(1)}`,
    textAlign: 'left',
    verticalAlign: 'top',
  },
  '& th': {
    fontWeight: 600,
    backgroundColor: alpha(theme.palette.common.black, 0.12),
  },
}));

// ---- Component overrides for react-markdown ------------------------------

const buildComponents = (sources: SourceItem[], messageId: string) => {
  const wrapText = (children: ReactNode) =>
    walkChildrenForCitations(children, sources, messageId);

  return {
    a: ({ children, href, ...rest }: { children?: ReactNode; href?: string }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {wrapText(children)}
      </a>
    ),
    p: ({ children }: { children?: ReactNode }) => <p>{wrapText(children)}</p>,
    li: ({ children }: { children?: ReactNode }) => <li>{wrapText(children)}</li>,
    strong: ({ children }: { children?: ReactNode }) => <strong>{wrapText(children)}</strong>,
    em: ({ children }: { children?: ReactNode }) => <em>{wrapText(children)}</em>,
    h1: ({ children }: { children?: ReactNode }) => <h1>{wrapText(children)}</h1>,
    h2: ({ children }: { children?: ReactNode }) => <h2>{wrapText(children)}</h2>,
    h3: ({ children }: { children?: ReactNode }) => <h3>{wrapText(children)}</h3>,
    h4: ({ children }: { children?: ReactNode }) => <h4>{wrapText(children)}</h4>,
    td: ({ children }: { children?: ReactNode }) => <td>{wrapText(children)}</td>,
    th: ({ children }: { children?: ReactNode }) => <th>{wrapText(children)}</th>,
    code: ({
      children,
      className,
      // react-markdown injects an `inline` flag in v9-v10 only when called
      // inside a paragraph (single-backtick code). Fenced blocks have a
      // language- prefix className.
      ...rest
    }: {
      children?: ReactNode;
      className?: string;
      inline?: boolean;
    }) => (
      <CodeBlock className={className} inline={(rest as { inline?: boolean }).inline}>
        {children}
      </CodeBlock>
    ),
    // For fenced code, `pre` is the parent — we render it transparent so the
    // CodeBlock's own wrapper provides the styled background + header.
    pre: ({ children }: { children?: ReactNode }) => (
      <Box component="div" sx={{ background: 'transparent', p: 0, m: 0 }}>
        {children}
      </Box>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <TableScroll>
        <table>{children}</table>
      </TableScroll>
    ),
  };
};

// ---- Component -----------------------------------------------------------

const MarkdownAnswer = ({ content, sources, messageId }: MarkdownAnswerProps) => {
  const components = buildComponents(sources, messageId);
  return (
    <Root>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={components}
      >
        {content}
      </Markdown>
    </Root>
  );
};

export default MarkdownAnswer;
