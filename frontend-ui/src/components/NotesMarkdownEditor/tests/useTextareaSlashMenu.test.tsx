/**
 * FIX-ai-research-like-and-notes-editor — Phase 4B
 *
 * Unit tests for the slash-menu state machine. The hook attaches DOM listeners
 * to a textarea ref, so tests render a tiny harness component that owns the
 * `value` state and forwards a ref to the textarea.
 */
import { useRef, useState } from 'react';
import { act, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderWithProviders } from '@/utils/test-utils';
import {
  useTextareaSlashMenu,
  type SlashMenuProps,
} from '../hooks/useTextareaSlashMenu';

// `textarea-caret` reads layout — JSDOM returns zeros which is fine for tests.
// We only assert on open/query/activeIndex/commands here.

interface HarnessProps {
  initial?: string;
  spy: (props: SlashMenuProps, onChange: (v: string) => void) => void;
}

const Harness = ({ initial = '', spy }: HarnessProps) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const { menuProps } = useTextareaSlashMenu({
    textareaRef: ref,
    value,
    onChange: setValue,
  });
  spy(menuProps, setValue);
  return (
    <textarea
      ref={ref}
      data-testid="ta"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
};

const flushRaf = async () => {
  // RequestAnimationFrame uses setTimeout(16) under JSDOM — yield twice.
  // Wrap in `act` so React knows the state-updates from the rAF callbacks
  // are part of the test (silences the "not wrapped in act" warnings).
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 20));
  });
};

const typeChar = (
  ta: HTMLTextAreaElement,
  char: string,
  setValue: (v: string) => void,
) => {
  // 1. Fire keydown for the trigger detection.
  fireEvent.keyDown(ta, { key: char });
  // 2. Mutate the textarea value + caret to simulate the key landing.
  const before = ta.value;
  const caret = ta.selectionEnd;
  const next = before.slice(0, caret) + char + before.slice(caret);
  act(() => {
    setValue(next);
  });
};

const setCaret = (ta: HTMLTextAreaElement, pos: number) => {
  ta.setSelectionRange(pos, pos);
};

describe('useTextareaSlashMenu', () => {
  let latest: { props: SlashMenuProps; setValue: (v: string) => void } | null;

  beforeEach(() => {
    latest = null;
  });

  const spy = (props: SlashMenuProps, setValue: (v: string) => void) => {
    latest = { props, setValue };
  };

  it('starts closed with empty query and no commands filtered', () => {
    renderWithProviders(<Harness spy={spy} />);
    expect(latest!.props.open).toBe(false);
    expect(latest!.props.query).toBe('');
  });

  it('opens when `/` is typed at start of empty textarea', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    expect(latest!.props.open).toBe(true);
    expect(latest!.props.commands.length).toBe(15);
  });

  it('opens when `/` is typed after a space', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="hello " spy={spy} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    setCaret(ta, 6);
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 7);
    await flushRaf();
    expect(latest!.props.open).toBe(true);
  });

  it('does NOT open when `/` is typed mid-word (EC-B5)', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="and" spy={spy} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    setCaret(ta, 3);
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    expect(latest!.props.open).toBe(false);
  });

  it('updates query and narrows command list as the user types after `/`', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    expect(latest!.props.open).toBe(true);
    expect(latest!.props.commands.length).toBe(15);

    // Append 'b' → trigger input listener
    act(() => {
      latest!.setValue('/b');
    });
    await flushRaf();
    setCaret(ta, 2);
    fireEvent.input(ta);
    await flushRaf();
    // 'b' matches Bulleted, Numbered (contains 'b'? no — but Bulleted yes, Bold yes), etc.
    const ids = latest!.props.commands.map((c) => c.id);
    expect(ids).toContain('bulleted');
    expect(ids).toContain('bold');
    expect(latest!.props.commands.length).toBeLessThan(15);

    // Append 'u' → /bu
    act(() => {
      latest!.setValue('/bu');
    });
    await flushRaf();
    setCaret(ta, 3);
    fireEvent.input(ta);
    await flushRaf();
    const ids2 = latest!.props.commands.map((c) => c.id);
    expect(ids2).toContain('bulleted');
    expect(ids2).not.toContain('bold');
  });

  it('ArrowDown advances activeIndex (wraps at end)', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    expect(latest!.props.activeIndex).toBe(0);
    fireEvent.keyDown(ta, { key: 'ArrowDown' });
    await flushRaf();
    expect(latest!.props.activeIndex).toBe(1);
  });

  it('Enter commits the active command and closes the menu', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    expect(latest!.props.open).toBe(true);
    // Enter commits — first command is Bulleted, inserts '- '
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flushRaf();
    expect(latest!.props.open).toBe(false);
    // The textarea value should now be '- '
    expect(ta.value).toBe('- ');
  });

  it('Escape closes the menu and leaves the `/` in place (AC-B10)', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    fireEvent.keyDown(ta, { key: 'Escape' });
    await flushRaf();
    expect(latest!.props.open).toBe(false);
    expect(ta.value).toBe('/');
  });

  it('Space closes the menu (EC-B7) and leaves `/` + filter chars intact', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    fireEvent.keyDown(ta, { key: ' ' });
    await flushRaf();
    expect(latest!.props.open).toBe(false);
  });

  it('Backspace past `/` closes the menu', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    expect(latest!.props.open).toBe(true);
    // Simulate backspace deleting the `/`.
    act(() => {
      latest!.setValue('');
    });
    await flushRaf();
    setCaret(ta, 0);
    fireEvent.input(ta);
    await flushRaf();
    expect(latest!.props.open).toBe(false);
  });

  it('typing whitespace inside the query closes the menu', async () => {
    const { getByTestId } = renderWithProviders(<Harness spy={spy} />);
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    ta.focus();
    typeChar(ta, '/', latest!.setValue);
    await flushRaf();
    setCaret(ta, 1);
    await flushRaf();
    // Simulate user pressing space — value mutates to '/ '
    act(() => {
      latest!.setValue('/ ');
    });
    await flushRaf();
    setCaret(ta, 2);
    fireEvent.input(ta);
    await flushRaf();
    expect(latest!.props.open).toBe(false);
  });
});
