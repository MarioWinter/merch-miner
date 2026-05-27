/**
 * NotesMarkdownEditor — Preview-mode markdown renderer.
 *
 * Phase 5: react-markdown + remark-gfm + remark-github-blockquote-alert with
 * theme-token callout styling, interactive GFM checkboxes, and an empty-state
 * placeholder. Borrows the `Root` markdown CSS pattern from MarkdownAnswer.tsx
 * (PROJ-20) without importing it — that one is citation- and code-block-specific.
 */
import { useCallback, useRef, type MouseEvent, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkAlert } from 'remark-github-blockquote-alert';

export interface NotesMarkdownRendererProps {
  value: string;
  onChange: (next: string) => void;
  emptyPlaceholderI18nKey?: string;
}

// No rehype-sanitize: source is markdown-only (no rehype-raw → no inline
// HTML allowed through). Sanitize was previously stripping `node.position`
// metadata, which broke interactive checkboxes (the input override could
// not locate its source-line offset). The blockquote-alert plugin's emitted
// `<svg>` and class names render correctly without sanitize.

// ---- Root styled wrapper (markdown CSS + callout palette) ----------------

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
  '& code': {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: '0.8125rem',
    padding: `${theme.spacing(0.125)} ${theme.spacing(0.5)}`,
    borderRadius: 3,
    backgroundColor: alpha(theme.palette.common.black, 0.2),
  },
  '& pre': {
    margin: `${theme.spacing(0.75)} 0`,
    padding: theme.spacing(1),
    borderRadius: 4,
    backgroundColor: alpha(theme.palette.common.black, 0.2),
    overflowX: 'auto',
    '& code': {
      backgroundColor: 'transparent',
      padding: 0,
    },
  },
  // Callout wrapper styling — the plugin emits divs with these class names.
  '& .markdown-alert': {
    padding: theme.spacing(1, 1.5),
    margin: theme.spacing(0.75, 0),
    borderLeft: '4px solid currentColor',
    borderRadius: 4,
    '& > .markdown-alert-title': {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      fontWeight: 600,
      marginTop: 0,
      marginBottom: theme.spacing(0.25),
      '& svg.octicon': {
        width: 16,
        height: 16,
        fill: 'currentColor',
      },
    },
    // Body text inside the callout uses the standard text color, NOT the
    // alert tint — only the title + border + tinted bg carry the alert color.
    '& > p:not(.markdown-alert-title)': {
      color: theme.vars.palette.text.primary,
    },
  },
  '& .markdown-alert-note': {
    color: theme.vars.palette.info.main,
    backgroundColor: alpha(theme.palette.info.main, 0.08),
  },
  '& .markdown-alert-tip': {
    color: theme.vars.palette.success.main,
    backgroundColor: alpha(theme.palette.success.main, 0.08),
  },
  '& .markdown-alert-warning': {
    color: theme.vars.palette.warning.main,
    backgroundColor: alpha(theme.palette.warning.main, 0.08),
  },
  '& .markdown-alert-important': {
    color: theme.vars.palette.error.main,
    backgroundColor: alpha(theme.palette.error.main, 0.08),
  },
}));

// ---- Component overrides -------------------------------------------------

interface InputProps {
  type?: string;
  checked?: boolean;
  className?: string;
}

/**
 * Component overrides for react-markdown. The `input` override only strips
 * the GFM-injected `disabled` attribute so checkboxes are interactive;
 * the actual toggle logic lives in a delegated click handler on the Root
 * element (see `NotesMarkdownRenderer` below). React-markdown 9+ does not
 * expose `node.position` in the component props, so we map click → source
 * position by DOM index instead.
 */
const buildComponents = () => ({
  input: ({ type, checked, ...rest }: InputProps) => {
    if (type !== 'checkbox') {
      return <input type={type} {...rest} />;
    }
    // `onChange` is intentionally a no-op — React requires an onChange on a
    // controlled `<input checked>`, and the actual toggle is handled by the
    // Root-level click delegation. Without this no-op React warns about an
    // uncontrolled input becoming controlled.
    return <input type="checkbox" checked={!!checked} onChange={() => {}} />;
  },
  a: ({ children, href, ...rest }: { children?: ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
    </a>
  ),
});

/**
 * Find the source positions of every GFM task-list marker (`- [ ]` or
 * `- [x]` at the start of a line, possibly indented). The Nth match aligns
 * with the Nth `<input type="checkbox">` react-markdown renders.
 */
const findTaskMarkers = (source: string): Array<{ start: number; checked: boolean }> => {
  const out: Array<{ start: number; checked: boolean }> = [];
  const re = /^[ \t]*(-\s\[[ xX]\]\s)/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // The marker literal begins at the `-` — which is `m.index` plus any
    // leading whitespace captured by `[ \t]*`.
    const dashIdx = source.indexOf('-', m.index);
    if (dashIdx === -1) continue;
    const ch = source[dashIdx + 3]; // the char inside [ ]
    out.push({ start: dashIdx, checked: ch.toLowerCase() === 'x' });
  }
  return out;
};

// ---- Component -----------------------------------------------------------

const NotesMarkdownRenderer = (props: NotesMarkdownRendererProps) => {
  const {
    value,
    onChange,
    emptyPlaceholderI18nKey = 'notesEditor.placeholder.empty',
  } = props;
  const { t } = useTranslation();

  const isEmpty = value.trim() === '';

  // Root container ref so we can enumerate rendered checkboxes on click.
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Stable components map — no per-value dependency; checkbox toggle lives
  // in the Root-level click handler below.
  const components = buildComponents();

  // Delegated click handler: when the user clicks a task-list checkbox,
  // find its index among all rendered checkboxes (= its source-order index)
  // and toggle the matching `- [ ]`/`- [x]` literal in the markdown source.
  const handleRootClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') {
        return;
      }
      const root = rootRef.current;
      if (!root) return;
      const allCheckboxes = Array.from(
        root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
      );
      const idx = allCheckboxes.indexOf(target);
      if (idx === -1) return;
      const markers = findTaskMarkers(value);
      const match = markers[idx];
      if (!match) return;
      const span = value.slice(match.start, match.start + 5);
      if (span !== '- [ ]' && span !== '- [x]' && span !== '- [X]') return;
      const toggled = match.checked ? '- [ ]' : '- [x]';
      onChange(
        value.slice(0, match.start) + toggled + value.slice(match.start + 5),
      );
    },
    [value, onChange],
  );

  if (isEmpty) {
    return (
      <Typography
        variant="body2"
        sx={{ fontStyle: 'italic', color: 'text.secondary', p: 1.5 }}
      >
        {t(emptyPlaceholderI18nKey)}
      </Typography>
    );
  }

  return (
    <Root
      ref={rootRef}
      onClick={handleRootClick}
      data-testid="notes-markdown-renderer"
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkAlert]}
        components={components}
      >
        {value}
      </Markdown>
    </Root>
  );
};

export default NotesMarkdownRenderer;
