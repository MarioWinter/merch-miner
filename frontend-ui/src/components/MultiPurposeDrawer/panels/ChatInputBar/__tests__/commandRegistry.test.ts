/**
 * PROJ-20 Phase 3.5 — commandRegistry tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
  COMMANDS,
  findMatches,
  findExact,
  type CommandContext,
} from '../utils/commandRegistry';

const buildCtx = (overrides: Partial<CommandContext> = {}): CommandContext => {
  const dispatch = vi.fn();
  const enqueueSnackbar = vi.fn();
  // Simple t() — returns the key so we can assert what was passed.
  const t = vi.fn((key: string) => key);
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch: dispatch as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enqueueSnackbar: enqueueSnackbar as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: t as any,
    removeChip: vi.fn(),
    ...overrides,
  };
};

describe('commandRegistry (PROJ-20 Phase 3.5)', () => {
  it('exports exactly 6 canonical commands', () => {
    // PROJ-20 refactor: /auto and /web collapsed into a single /chat command.
    expect(COMMANDS).toHaveLength(6);
    const names = COMMANDS.map((c) => c.name).sort();
    expect(names).toEqual(
      ['agent', 'chat', 'clear-context', 'help', 'model', 'niche'].sort(),
    );
  });

  it('every command has trigger starting with "/"', () => {
    COMMANDS.forEach((c) => {
      expect(c.trigger.startsWith('/')).toBe(true);
      expect(c.trigger.slice(1)).toBe(c.name);
    });
  });

  it('findMatches with empty query returns all commands in registry order', () => {
    const out = findMatches('');
    expect(out.map((c) => c.name)).toEqual(COMMANDS.map((c) => c.name));
  });

  it('findMatches "cha" returns only /chat', () => {
    // PROJ-20 refactor: /auto is gone; /chat is the canonical chat-mode command.
    const out = findMatches('cha');
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('chat');
  });

  it('findMatches is case-insensitive', () => {
    const lower = findMatches('age');
    const upper = findMatches('AGE');
    expect(lower.map((c) => c.name)).toEqual(['agent']);
    expect(upper.map((c) => c.name)).toEqual(['agent']);
  });

  it('findMatches substring "e" matches multiple commands', () => {
    const out = findMatches('e');
    // 'e' appears in: agent, niche, clear-context, help, model
    const names = out.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['agent', 'niche', 'clear-context', 'help', 'model']),
    );
  });

  it('findMatches with unknown query returns empty array', () => {
    const out = findMatches('xyzzz');
    expect(out).toEqual([]);
  });

  it('findExact returns the matching command', () => {
    const c = findExact('chat');
    expect(c?.name).toBe('chat');
  });

  it('findExact returns null for non-exact match', () => {
    expect(findExact('cha')).toBeNull();
    expect(findExact('zzz')).toBeNull();
  });

  describe('executors', () => {
    it('/chat dispatches setModeOverride("chat") + snackbar', () => {
      // PROJ-20 refactor: /auto + /web were folded into /chat.
      const ctx = buildCtx();
      const cmd = findExact('chat')!;
      cmd.execute(ctx);
      expect(ctx.dispatch).toHaveBeenCalledTimes(1);
      const action = (ctx.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(action.type).toBe('chatBar/setModeOverride');
      expect(action.payload).toBe('chat');
      expect(ctx.enqueueSnackbar).toHaveBeenCalledWith(
        'search.commands.chat.snackbar',
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('/agent dispatches setModeOverride("agent")', () => {
      const ctx = buildCtx();
      findExact('agent')!.execute(ctx);
      const action = (ctx.dispatch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(action.payload).toBe('agent');
    });

    it('/clear-context calls removeChip + snackbar', () => {
      const ctx = buildCtx();
      findExact('clear-context')!.execute(ctx);
      expect(ctx.removeChip).toHaveBeenCalledTimes(1);
      expect(ctx.enqueueSnackbar).toHaveBeenCalledWith(
        'search.commands.clearContext.snackbar',
        expect.objectContaining({ variant: 'success' }),
      );
    });

    it('/niche calls openMentionPicker when provided', () => {
      const openMentionPicker = vi.fn();
      const ctx = buildCtx({ openMentionPicker });
      findExact('niche')!.execute(ctx);
      expect(openMentionPicker).toHaveBeenCalledTimes(1);
    });

    it('/niche falls back to snackbar when no openMentionPicker provided', () => {
      const ctx = buildCtx({ openMentionPicker: undefined });
      findExact('niche')!.execute(ctx);
      expect(ctx.enqueueSnackbar).toHaveBeenCalled();
    });

    it('/model calls openModelPopover when provided', () => {
      const openModelPopover = vi.fn();
      const ctx = buildCtx({ openModelPopover });
      findExact('model')!.execute(ctx);
      expect(openModelPopover).toHaveBeenCalledTimes(1);
    });

    it('/model falls back to info snackbar when no popover wired', () => {
      const ctx = buildCtx({ openModelPopover: undefined });
      findExact('model')!.execute(ctx);
      expect(ctx.enqueueSnackbar).toHaveBeenCalledWith(
        'search.commands.model.snackbar',
        expect.objectContaining({ variant: 'info' }),
      );
    });

    it('/help calls openHelpPopup when provided', () => {
      const openHelpPopup = vi.fn();
      const ctx = buildCtx({ openHelpPopup });
      findExact('help')!.execute(ctx);
      expect(openHelpPopup).toHaveBeenCalledTimes(1);
    });
  });
});
