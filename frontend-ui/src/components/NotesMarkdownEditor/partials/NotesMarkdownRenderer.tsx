/**
 * NotesMarkdownEditor — Preview-mode markdown renderer.
 *
 * Phase 5: react-markdown + remark-gfm + remark-github-blockquote-alert with
 * theme-token callout styling, interactive GFM checkboxes, and an empty-state
 * placeholder. Borrows the `Root` markdown CSS pattern from MarkdownAnswer.tsx
 * (PROJ-20) without importing it — that one is citation- and code-block-specific.
 */
import { useMemo, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { remarkAlert } from 'remark-github-blockquote-alert';
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from 'rehype-sanitize';

export interface NotesMarkdownRendererProps {
  value: string;
  onChange: (next: string) => void;
  emptyPlaceholderI18nKey?: string;
}

// ---- Sanitize schema -----------------------------------------------------
// The plugin emits `<div class="markdown-alert …">`, `<p class="markdown-alert-title">`
// containing an inline `<svg class="octicon">…<path … /></svg>`. The default
// rehype-sanitize schema:
//   - strips `className` (not in the global `*` allowlist)
//   - drops `<svg>` and `<path>` entirely (not in default `tagNames`)
//   - forces `<input type=checkbox disabled>` (we want interactive checkboxes)
// Extend the schema to allow our specific cases without opening the floodgates.
const schema: SanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'svg', 'path'],
  attributes: {
    ...defaultSchema.attributes,
    div: [...(defaultSchema.attributes?.div ?? []), 'className'],
    p: [...(defaultSchema.attributes?.p ?? []), 'className'],
    span: [...(defaultSchema.attributes?.span ?? []), 'className'],
    li: [...(defaultSchema.attributes?.li ?? []), 'className'],
    ul: [...(defaultSchema.attributes?.ul ?? []), 'className'],
    // Override the default `[ 'disabled', true ]` tuple so we can render
    // checkboxes without the forced `disabled` attribute.
    input: ['type', 'checked', 'className'],
    svg: ['className', 'viewBox', 'width', 'height', 'ariaHidden', 'fill'],
    path: ['d', 'fillRule', 'clipRule'],
  },
};

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
  node?: { properties?: { type?: string; checked?: boolean } };
}

/**
 * Build the components override map. The `input` override handles
 * GFM task-list checkbox toggles by mapping the clicked DOM element to its
 * source-position via the `taskMatches` index (count of `- [ ]` / `- [x]` in
 * the source up to and including the clicked occurrence).
 */
const buildComponents = (
  value: string,
  onChange: (next: string) => void,
  taskMatches: Array<{ start: number; checked: boolean }>,
) => {
  // Mutable counter — incremented per checkbox render so each `<input>` knows
  // its task-list-item index. Reset per render by being re-created inside
  // `useMemo` below.
  const counter = { current: 0 };

  return {
    input: ({ type, checked, ...rest }: InputProps) => {
      if (type !== 'checkbox') {
        return <input type={type} {...rest} />;
      }
      const idx = counter.current;
      counter.current += 1;
      const match = taskMatches[idx];
      return (
        <input
          type="checkbox"
          checked={!!checked}
          onChange={() => {
            if (!match) return;
            // Replace the 5-char prefix `- [ ]` or `- [x]` at match.start.
            const before = value.slice(0, match.start);
            const after = value.slice(match.start + 5);
            const toggled = match.checked ? '- [ ]' : '- [x]';
            onChange(before + toggled + after);
          }}
        />
      );
    },
    a: ({ children, href, ...rest }: { children?: ReactNode; href?: string }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    ),
  };
};

// Enumerate the source positions of every GFM task-list-item prefix
// (`- [ ] ` or `- [x] `) at the start of a line. The Nth match aligns with
// the Nth `<input type="checkbox">` produced by react-markdown's GFM output.
const enumerateTaskMatches = (source: string): Array<{ start: number; checked: boolean }> => {
  const matches: Array<{ start: number; checked: boolean }> = [];
  // Multiline mode — `^` matches start-of-line. Accept any leading whitespace
  // so nested task-list items still map correctly.
  const re = /^[ \t]*-\s\[([ xX])\]\s/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    // Track the position of the `- ` literal so the toggle slice replaces
    // exactly the 5-char `- [ ]` / `- [x]` span.
    const dashIdx = source.indexOf('- [', m.index);
    if (dashIdx === -1) continue;
    matches.push({
      start: dashIdx,
      checked: m[1].toLowerCase() === 'x',
    });
  }
  return matches;
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

  // Recompute the task-match table per render so checkbox indices stay in
  // sync with the source.
  const taskMatches = useMemo(() => enumerateTaskMatches(value), [value]);
  const components = useMemo(
    () => buildComponents(value, onChange, taskMatches),
    [value, onChange, taskMatches],
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
    <Root data-testid="notes-markdown-renderer">
      <Markdown
        remarkPlugins={[remarkGfm, remarkAlert]}
        rehypePlugins={[[rehypeSanitize, schema]]}
        components={components}
      >
        {value}
      </Markdown>
    </Root>
  );
};

export default NotesMarkdownRenderer;
