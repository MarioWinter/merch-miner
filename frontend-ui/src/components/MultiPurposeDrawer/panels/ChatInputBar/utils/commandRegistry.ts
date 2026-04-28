/**
 * PROJ-20 Phase 3.5 — Slash Command Registry
 *
 * User-driven refactor 2026-04-28: Mode reduced to 2 (Chat/Agent). The legacy
 * `/auto` and `/web` commands are gone; `/chat` replaces `/web` and dispatches
 * `setModeOverride('chat')`. The slice handles bidirectional Tab/Mode sync —
 * commands automatically flip the drawer tab too.
 *
 * Pure data + executor definitions for the `/command` palette. The registry
 * is the single source of truth — both `CommandPalette` (rendering) and
 * `useCommandTrigger` (matching/execution) read from it.
 */
import type { TFunction } from 'i18next';
import type { useSnackbar } from 'notistack';
import type { AppDispatch } from '@/store';
import { setModeOverride } from '@/store/chatBarSlice';

export type CommandName =
  | 'chat'
  | 'agent'
  | 'niche'
  | 'clear-context'
  | 'model'
  | 'help';

export interface CommandContext {
  dispatch: AppDispatch;
  enqueueSnackbar: ReturnType<typeof useSnackbar>['enqueueSnackbar'];
  t: TFunction;
  /** Trigger the same flow as typing `@` — caller controls how. */
  openMentionPicker?: () => void;
  /** Open the Model-Picker popover (Phase 3.6). */
  openModelPopover?: () => void;
  /** Open the `/help` modal. */
  openHelpPopup?: () => void;
  /** SmartTextarea imperative removeChip. */
  removeChip: () => void;
}

export interface Command {
  /** Bare name without slash, used as registry key + matcher. */
  name: CommandName;
  /** Canonical form including slash, e.g. `/chat`. */
  trigger: string;
  /** i18n key for the row description (e.g. "Switch to Chat mode"). */
  descriptionKey: string;
  /** i18n key for the success snackbar message after execution. */
  snackbarKey: string;
  /** Optional example string shown in the /help table (literal, not i18n). */
  example?: string;
  /** Action executor. */
  execute: (ctx: CommandContext) => void;
}

export const COMMANDS: Command[] = [
  {
    name: 'chat',
    trigger: '/chat',
    descriptionKey: 'search.commands.chat.description',
    snackbarKey: 'search.commands.chat.snackbar',
    example: '/chat',
    execute: ({ dispatch, enqueueSnackbar, t }) => {
      dispatch(setModeOverride('chat'));
      enqueueSnackbar(t('search.commands.chat.snackbar'), { variant: 'success' });
    },
  },
  {
    name: 'agent',
    trigger: '/agent',
    descriptionKey: 'search.commands.agent.description',
    snackbarKey: 'search.commands.agent.snackbar',
    example: '/agent',
    execute: ({ dispatch, enqueueSnackbar, t }) => {
      dispatch(setModeOverride('agent'));
      enqueueSnackbar(t('search.commands.agent.snackbar'), { variant: 'success' });
    },
  },
  {
    name: 'niche',
    trigger: '/niche',
    descriptionKey: 'search.commands.niche.description',
    snackbarKey: 'search.commands.niche.snackbar',
    example: '/niche',
    execute: ({ openMentionPicker, enqueueSnackbar, t }) => {
      if (openMentionPicker) {
        openMentionPicker();
      } else {
        enqueueSnackbar(t('search.commands.niche.snackbar'), { variant: 'info' });
      }
    },
  },
  {
    name: 'clear-context',
    trigger: '/clear-context',
    descriptionKey: 'search.commands.clearContext.description',
    snackbarKey: 'search.commands.clearContext.snackbar',
    example: '/clear-context',
    execute: ({ removeChip, enqueueSnackbar, t }) => {
      removeChip();
      enqueueSnackbar(t('search.commands.clearContext.snackbar'), {
        variant: 'success',
      });
    },
  },
  {
    name: 'model',
    trigger: '/model',
    descriptionKey: 'search.commands.model.description',
    snackbarKey: 'search.commands.model.snackbar',
    example: '/model',
    execute: ({ openModelPopover, enqueueSnackbar, t }) => {
      if (openModelPopover) {
        openModelPopover();
      } else {
        // Phase 3.6 will wire the actual popover. For now, surface a
        // breadcrumb so the user knows the command was received.
        enqueueSnackbar(t('search.commands.model.snackbar'), { variant: 'info' });
      }
    },
  },
  {
    name: 'help',
    trigger: '/help',
    descriptionKey: 'search.commands.help.description',
    snackbarKey: 'search.commands.help.snackbar',
    example: '/help',
    execute: ({ openHelpPopup, enqueueSnackbar, t }) => {
      if (openHelpPopup) {
        openHelpPopup();
      } else {
        enqueueSnackbar(t('search.commands.help.snackbar'), { variant: 'info' });
      }
    },
  },
];

/**
 * Plain substring match on `name`, case-insensitive. Empty query returns
 * all commands. Order is preserved (registry definition order).
 */
export const findMatches = (query: string): Command[] => {
  const q = query.trim().toLowerCase();
  if (!q) return [...COMMANDS];
  return COMMANDS.filter((c) => c.name.toLowerCase().includes(q));
};

/**
 * Look up a command by exact `name` match (no slash). Returns `null` if
 * unknown — used by `useCommandTrigger` to decide whether Enter executes
 * vs. closes-without-action.
 */
export const findExact = (name: string): Command | null => {
  const n = name.trim().toLowerCase();
  return COMMANDS.find((c) => c.name === n) ?? null;
};
