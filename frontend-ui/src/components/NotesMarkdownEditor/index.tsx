/**
 * NotesMarkdownEditor — Notion-style WYSIWYG editor for niche notes.
 *
 * Replaces the previous Edit/Preview Tabs implementation. Built on TipTap +
 * ProseMirror with markdown round-trip (tiptap-markdown). Formatting renders
 * inline as the user types — lists, checklists (interactive), headings,
 * quote, code, bold, links, divider. The `value` prop is plain-text
 * markdown; the editor parses on mount and re-serializes on every change.
 *
 * Slash menu: typing `/` opens a Notion-style command palette via the
 * TipTap `Suggestion` extension. See `slashCommand.ts`.
 *
 * Form integration: matches the old API (`value` / `onChange` / `onBlur` /
 * `error` / `helperText`) so `react-hook-form` Controller wiring in
 * PipelineEditForm needs no changes.
 */
import { useEffect, useRef } from 'react';
import { Box, FormHelperText } from '@mui/material';
import { styled, alpha } from '@mui/material/styles';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from 'tiptap-markdown';
import { useTranslation } from 'react-i18next';
import { createSlashCommand, type SlashCommandItem } from './slashCommand';

export interface NotesMarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  onBlur?: () => void;
  error?: boolean;
  helperText?: React.ReactNode;
  disabled?: boolean;
  /** Kept for API compatibility with the old textarea — no longer used. */
  minRows?: number;
  /** Kept for API compatibility with the old textarea — no longer used. */
  maxRows?: number;
}

// Editor surface styled to look like a textarea but render inline markdown.
const EditorSurface = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'editorError' && prop !== 'editorDisabled',
})<{ editorError?: boolean; editorDisabled?: boolean }>(
  ({ theme, editorError, editorDisabled }) => ({
    minHeight: 96,
    maxHeight: 480,
    overflowY: 'auto',
    resize: 'vertical',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${
      editorError
        ? theme.vars.palette.error.main
        : alpha(theme.palette.divider, 0.6)
    }`,
    backgroundColor: editorDisabled
      ? alpha(theme.palette.action.disabledBackground, 0.4)
      : 'transparent',
    cursor: editorDisabled ? 'not-allowed' : 'text',
    color: theme.vars.palette.text.primary,
    fontSize: '0.875rem',
    lineHeight: 1.55,
    transition: 'border-color 120ms ease',
    '&:focus-within': {
      borderColor: editorError
        ? theme.vars.palette.error.main
        : theme.vars.palette.primary.main,
    },
    // ProseMirror content styles
    '& .ProseMirror': {
      outline: 'none',
      minHeight: 80,
      '& > *:first-of-type': { marginTop: 0 },
      '& > *:last-child': { marginBottom: 0 },
      '& p': { margin: `${theme.spacing(0.5)} 0` },
      '& h1': {
        fontSize: '1.25rem',
        fontWeight: 700,
        margin: `${theme.spacing(1.25)} 0 ${theme.spacing(0.5)}`,
      },
      '& h2': {
        fontSize: '1.125rem',
        fontWeight: 700,
        margin: `${theme.spacing(1.25)} 0 ${theme.spacing(0.5)}`,
      },
      '& h3': {
        fontSize: '1rem',
        fontWeight: 600,
        margin: `${theme.spacing(1)} 0 ${theme.spacing(0.5)}`,
      },
      '& ul, & ol': {
        paddingLeft: theme.spacing(2.5),
        margin: `${theme.spacing(0.5)} 0`,
      },
      '& li': { marginBottom: theme.spacing(0.25) },
      // Task list (checklist) — TipTap renders task items as <li data-type="taskItem">
      '& ul[data-type="taskList"]': {
        listStyle: 'none',
        paddingLeft: theme.spacing(0.5),
        '& li': {
          display: 'flex',
          alignItems: 'flex-start',
          gap: theme.spacing(1),
        },
        '& li > label': {
          flex: '0 0 auto',
          marginTop: 2,
          cursor: 'pointer',
        },
        '& li > div': { flex: 1 },
        '& li[data-checked="true"] > div': {
          textDecoration: 'line-through',
          color: theme.vars.palette.text.secondary,
        },
        '& input[type="checkbox"]': {
          cursor: 'pointer',
          accentColor: theme.vars.palette.primary.main,
        },
      },
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
        '& code': { backgroundColor: 'transparent', padding: 0 },
      },
      '& a': {
        color: theme.vars.palette.secondary.main,
        textDecoration: 'underline',
        cursor: 'pointer',
      },
      // Placeholder (rendered by @tiptap/extension-placeholder)
      '& p.is-editor-empty:first-of-type::before': {
        content: 'attr(data-placeholder)',
        float: 'left',
        color: theme.vars.palette.text.secondary,
        fontStyle: 'italic',
        pointerEvents: 'none',
        height: 0,
      },
    },
  }),
);

const NotesMarkdownEditor = (props: NotesMarkdownEditorProps) => {
  const {
    value,
    onChange,
    placeholder,
    ariaLabel,
    onBlur,
    error,
    helperText,
    disabled,
  } = props;
  const { t } = useTranslation();

  // Build the 15 slash-command items. Each `command` runs the equivalent
  // TipTap operation that produces the same markdown the old slash menu
  // inserted.
  const commands: SlashCommandItem[] = [
    {
      id: 'bulleted',
      label: t('notesEditor.commands.bulleted.label'),
      description: t('notesEditor.commands.bulleted.description'),
      command: (editor) => editor.chain().focus().toggleBulletList().run(),
    },
    {
      id: 'todo',
      label: t('notesEditor.commands.todo.label'),
      description: t('notesEditor.commands.todo.description'),
      command: (editor) => editor.chain().focus().toggleTaskList().run(),
    },
    {
      id: 'numbered',
      label: t('notesEditor.commands.numbered.label'),
      description: t('notesEditor.commands.numbered.description'),
      command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      id: 'h1',
      label: t('notesEditor.commands.h1.label'),
      description: t('notesEditor.commands.h1.description'),
      command: (editor) =>
        editor.chain().focus().setHeading({ level: 1 }).run(),
    },
    {
      id: 'h2',
      label: t('notesEditor.commands.h2.label'),
      description: t('notesEditor.commands.h2.description'),
      command: (editor) =>
        editor.chain().focus().setHeading({ level: 2 }).run(),
    },
    {
      id: 'h3',
      label: t('notesEditor.commands.h3.label'),
      description: t('notesEditor.commands.h3.description'),
      command: (editor) =>
        editor.chain().focus().setHeading({ level: 3 }).run(),
    },
    {
      id: 'quote',
      label: t('notesEditor.commands.quote.label'),
      description: t('notesEditor.commands.quote.description'),
      command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      id: 'callout-note',
      label: t('notesEditor.commands.callout-note.label'),
      description: t('notesEditor.commands.callout-note.description'),
      command: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent('> **Note:** \n')
          .run(),
    },
    {
      id: 'callout-tip',
      label: t('notesEditor.commands.callout-tip.label'),
      description: t('notesEditor.commands.callout-tip.description'),
      command: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent('> **Tip:** \n')
          .run(),
    },
    {
      id: 'callout-warning',
      label: t('notesEditor.commands.callout-warning.label'),
      description: t('notesEditor.commands.callout-warning.description'),
      command: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent('> **Warning:** \n')
          .run(),
    },
    {
      id: 'callout-important',
      label: t('notesEditor.commands.callout-important.label'),
      description: t('notesEditor.commands.callout-important.description'),
      command: (editor) =>
        editor
          .chain()
          .focus()
          .insertContent('> **Important:** \n')
          .run(),
    },
    {
      id: 'code-block',
      label: t('notesEditor.commands.code-block.label'),
      description: t('notesEditor.commands.code-block.description'),
      command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      id: 'divider',
      label: t('notesEditor.commands.divider.label'),
      description: t('notesEditor.commands.divider.description'),
      command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      id: 'bold',
      label: t('notesEditor.commands.bold.label'),
      description: t('notesEditor.commands.bold.description'),
      command: (editor) => editor.chain().focus().toggleBold().run(),
    },
    {
      id: 'link',
      label: t('notesEditor.commands.link.label'),
      description: t('notesEditor.commands.link.description'),
      command: (editor) => {
        const url = window.prompt('URL', 'https://');
        if (url) {
          editor.chain().focus().setLink({ href: url }).run();
        }
      },
    },
  ];

  // Slash-command extension reads commands via a stable ref getter, so the
  // editor doesn't need recreating on every render of the parent component.
  const commandsRef = useRef(commands);
  useEffect(() => {
    commandsRef.current = commands;
  }, [commands]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: { HTMLAttributes: { spellcheck: 'false' } },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? '',
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        bulletListMarker: '-',
        linkify: true,
        breaks: false,
        transformPastedText: true,
      }),
      // eslint-disable-next-line react-hooks/refs
      createSlashCommand(() => commandsRef.current),
    ],
    editable: !disabled,
    content: value,
    editorProps: {
      attributes: {
        'aria-label': ariaLabel ?? '',
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = (ed.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown() as string;
      // Avoid feedback loop: skip if identical to current prop value.
      if (md !== value) onChange(md);
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  // Sync external value changes (e.g. form reset, niche switch) into the
  // editor without nuking caret position when the change came from the
  // editor itself.
  useEffect(() => {
    if (!editor) return;
    const current = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown() as string;
    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  return (
    <Box>
      <EditorSurface editorError={!!error} editorDisabled={!!disabled}>
        <EditorContent editor={editor} />
      </EditorSurface>
      {helperText && (
        <FormHelperText error={!!error} sx={{ mx: 1.75, mt: 0.5 }}>
          {helperText}
        </FormHelperText>
      )}
    </Box>
  );
};

export default NotesMarkdownEditor;
