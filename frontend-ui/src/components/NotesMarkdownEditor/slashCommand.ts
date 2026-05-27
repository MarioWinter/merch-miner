/**
 * TipTap slash-command extension for NotesMarkdownEditor.
 *
 * Uses `@tiptap/suggestion` to detect `/` at start-of-block or after
 * whitespace, then renders a MUI Popper menu (see `SlashCommandRenderer`).
 * The host component supplies the localized command list via a lazy
 * getter so language changes pick up new labels without re-creating the
 * editor.
 */
import { Extension } from '@tiptap/core';
import type { Editor, Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type { SuggestionOptions } from '@tiptap/suggestion';
import { renderSlashPopup, type SlashRenderApi } from './slashRenderer';

export interface SlashCommandItem {
  id: string;
  label: string;
  description: string;
  command: (editor: Editor) => void;
}

interface SlashSuggestionProps {
  query: string;
  range: Range;
  editor: Editor;
}

interface SlashStorage {
  getItems: () => SlashCommandItem[];
}

export const createSlashCommand = (
  getItems: () => SlashCommandItem[],
) => {
  return Extension.create<unknown, SlashStorage>({
    name: 'slashCommand',
    addStorage() {
      return { getItems };
    },
    addProseMirrorPlugins() {
      const suggestionOptions: SuggestionOptions<SlashCommandItem> = {
        editor: this.editor,
        char: '/',
        startOfLine: false,
        allowSpaces: false,
        // Show menu when `/` is typed at the very start of a node OR after a
        // whitespace character.
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const before = $from.parent.textBetween(
            Math.max(0, $from.parentOffset - 1),
            $from.parentOffset,
            undefined,
            '￼',
          );
          return before === '' || /\s/.test(before);
        },
        items: ({ query }: { query: string }) => {
          const items = this.storage.getItems();
          if (!query) return items;
          const q = query.toLowerCase();
          return items.filter((item) =>
            item.label.toLowerCase().includes(q),
          );
        },
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: SlashCommandItem;
        }) => {
          // Strip the trigger `/` + filter text BEFORE running the command.
          editor.chain().focus().deleteRange(range).run();
          props.command(editor);
        },
        render: () => {
          let api: SlashRenderApi | null = null;
          return {
            onStart: (suggestionProps: SlashSuggestionProps & {
              items: SlashCommandItem[];
              clientRect?: (() => DOMRect | null) | null;
              command: (item: SlashCommandItem) => void;
            }) => {
              api = renderSlashPopup({
                items: suggestionProps.items,
                clientRect: suggestionProps.clientRect ?? null,
                onSelect: suggestionProps.command,
              });
            },
            onUpdate: (suggestionProps: SlashSuggestionProps & {
              items: SlashCommandItem[];
              clientRect?: (() => DOMRect | null) | null;
              command: (item: SlashCommandItem) => void;
            }) => {
              api?.update({
                items: suggestionProps.items,
                clientRect: suggestionProps.clientRect ?? null,
                onSelect: suggestionProps.command,
              });
            },
            onKeyDown: (props: { event: KeyboardEvent }) => {
              if (!api) return false;
              return api.handleKeyDown(props.event);
            },
            onExit: () => {
              api?.destroy();
              api = null;
            },
          };
        },
      };
      return [Suggestion(suggestionOptions)];
    },
  });
};
