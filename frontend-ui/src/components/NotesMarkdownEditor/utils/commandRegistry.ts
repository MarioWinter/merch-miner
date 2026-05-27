/**
 * FIX-ai-research-like-and-notes-editor — Phase 4A
 *
 * Slash-command registry for the notes-editor `/menu`. Pure data — no React,
 * no DOM. The 15 commands from spec AC-B6, each tagged with an `iconName`
 * the consumer maps to the actual `@mui/icons-material` import.
 *
 * `caretOffsetFromInsertStart` defaults to "end of inserted text" when
 * undefined. `selectionStart`/`selectionEnd` only used for inline templates
 * that need to highlight a substring after insertion (Link → `url`).
 */

export type SlashBehaviour = 'line-prefix' | 'block' | 'inline';

export type SlashIconName =
  | 'FormatListBulleted'
  | 'CheckBoxOutlined'
  | 'FormatListNumbered'
  | 'Title'
  | 'TitleOutlined'
  | 'Subtitles'
  | 'FormatQuote'
  | 'InfoOutlined'
  | 'LightbulbOutlined'
  | 'WarningAmberOutlined'
  | 'PriorityHigh'
  | 'Code'
  | 'HorizontalRule'
  | 'FormatBold'
  | 'Link';

export interface SlashCommand {
  /** Stable id, also used as the i18n key suffix. */
  id: string;
  /** i18n key under `notesEditor.commands.<id>.label`. */
  labelKey: string;
  /** i18n key under `notesEditor.commands.<id>.description`. */
  descriptionKey: string;
  /** Icon name (consumer renders the matching @mui/icons-material component). */
  iconName: SlashIconName;
  /** Insertion strategy. */
  behaviour: SlashBehaviour;
  /** Raw markdown payload to insert. */
  insert: string;
  /**
   * Caret offset (in chars) relative to the START of `insert`.
   * Defaults to `insert.length` (end of insertion).
   */
  caretOffsetFromInsertStart?: number;
  /** For inline templates needing a selection range (Link → select 'url'). */
  selectionStart?: number;
  selectionEnd?: number;
}

export const COMMANDS: SlashCommand[] = [
  {
    id: 'bulleted',
    labelKey: 'notesEditor.commands.bulleted.label',
    descriptionKey: 'notesEditor.commands.bulleted.description',
    iconName: 'FormatListBulleted',
    behaviour: 'line-prefix',
    insert: '- ',
  },
  {
    id: 'todo',
    labelKey: 'notesEditor.commands.todo.label',
    descriptionKey: 'notesEditor.commands.todo.description',
    iconName: 'CheckBoxOutlined',
    behaviour: 'line-prefix',
    insert: '- [ ] ',
  },
  {
    id: 'numbered',
    labelKey: 'notesEditor.commands.numbered.label',
    descriptionKey: 'notesEditor.commands.numbered.description',
    iconName: 'FormatListNumbered',
    behaviour: 'line-prefix',
    insert: '1. ',
  },
  {
    id: 'h1',
    labelKey: 'notesEditor.commands.h1.label',
    descriptionKey: 'notesEditor.commands.h1.description',
    iconName: 'Title',
    behaviour: 'line-prefix',
    insert: '# ',
  },
  {
    id: 'h2',
    labelKey: 'notesEditor.commands.h2.label',
    descriptionKey: 'notesEditor.commands.h2.description',
    iconName: 'TitleOutlined',
    behaviour: 'line-prefix',
    insert: '## ',
  },
  {
    id: 'h3',
    labelKey: 'notesEditor.commands.h3.label',
    descriptionKey: 'notesEditor.commands.h3.description',
    iconName: 'Subtitles',
    behaviour: 'line-prefix',
    insert: '### ',
  },
  {
    id: 'quote',
    labelKey: 'notesEditor.commands.quote.label',
    descriptionKey: 'notesEditor.commands.quote.description',
    iconName: 'FormatQuote',
    behaviour: 'line-prefix',
    insert: '> ',
  },
  {
    id: 'callout-note',
    labelKey: 'notesEditor.commands.callout-note.label',
    descriptionKey: 'notesEditor.commands.callout-note.description',
    iconName: 'InfoOutlined',
    behaviour: 'block',
    insert: '> [!NOTE]\n> ',
  },
  {
    id: 'callout-tip',
    labelKey: 'notesEditor.commands.callout-tip.label',
    descriptionKey: 'notesEditor.commands.callout-tip.description',
    iconName: 'LightbulbOutlined',
    behaviour: 'block',
    insert: '> [!TIP]\n> ',
  },
  {
    id: 'callout-warning',
    labelKey: 'notesEditor.commands.callout-warning.label',
    descriptionKey: 'notesEditor.commands.callout-warning.description',
    iconName: 'WarningAmberOutlined',
    behaviour: 'block',
    insert: '> [!WARNING]\n> ',
  },
  {
    id: 'callout-important',
    labelKey: 'notesEditor.commands.callout-important.label',
    descriptionKey: 'notesEditor.commands.callout-important.description',
    iconName: 'PriorityHigh',
    behaviour: 'block',
    insert: '> [!IMPORTANT]\n> ',
  },
  {
    id: 'code-block',
    labelKey: 'notesEditor.commands.code-block.label',
    descriptionKey: 'notesEditor.commands.code-block.description',
    iconName: 'Code',
    behaviour: 'block',
    // ```\n\n```
    insert: '```\n\n```',
    // Caret sits on the middle empty line (after the first ``` + newline).
    caretOffsetFromInsertStart: 4,
  },
  {
    id: 'divider',
    labelKey: 'notesEditor.commands.divider.label',
    descriptionKey: 'notesEditor.commands.divider.description',
    iconName: 'HorizontalRule',
    behaviour: 'block',
    insert: '---\n',
  },
  {
    id: 'bold',
    labelKey: 'notesEditor.commands.bold.label',
    descriptionKey: 'notesEditor.commands.bold.description',
    iconName: 'FormatBold',
    behaviour: 'inline',
    insert: '****',
    // Caret between the two pairs.
    caretOffsetFromInsertStart: 2,
  },
  {
    id: 'link',
    labelKey: 'notesEditor.commands.link.label',
    descriptionKey: 'notesEditor.commands.link.description',
    iconName: 'Link',
    behaviour: 'inline',
    insert: '[text](url)',
    // Select 'url' (chars 7..10) so the user can paste immediately.
    selectionStart: 7,
    selectionEnd: 10,
  },
];

/**
 * Case-insensitive substring match against the *translated* labels provided
 * by the caller. We can't translate in this pure module (no i18n context)
 * so the caller pre-builds the `{id, label}` list. Empty query returns the
 * full registry in registry order.
 */
export const findMatches = (
  query: string,
  translated: { id: string; label: string }[],
): SlashCommand[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...COMMANDS];
  const allowedIds = new Set(
    translated
      .filter((entry) => entry.label.toLowerCase().includes(q))
      .map((entry) => entry.id),
  );
  return COMMANDS.filter((c) => allowedIds.has(c.id));
};
