/**
 * PROJ-20 Phase 3.5 — useCommandTrigger tests
 *
 * jsdom limits Selection/Range — same approach as `useMentionTrigger.test`.
 * We render a tiny harness exposing paletteProps + a real contenteditable
 * div that acts as the SmartTextarea root.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, act } from '@testing-library/react';
import {
  createRef,
  useImperativeHandle,
  forwardRef,
  useRef,
  useState,
} from 'react';
import { useCommandTrigger } from '../hooks/useCommandTrigger';
import type { SmartTextareaHandle } from '../SmartTextarea';
import type { CommandPaletteRenderProps } from '../hooks/useCommandTrigger';
import type { CommandContext } from '../utils/commandRegistry';

interface HarnessProps {
  ctxOverride?: Partial<CommandContext>;
}

interface HarnessHandle {
  paletteProps: CommandPaletteRenderProps;
  removeChipMock: ReturnType<typeof vi.fn>;
  dispatchMock: ReturnType<typeof vi.fn>;
  enqueueSnackbarMock: ReturnType<typeof vi.fn>;
  getEditable: () => HTMLDivElement;
}

const Harness = forwardRef<HarnessHandle, HarnessProps>(function Harness(
  { ctxOverride = {} },
  ref,
) {
  const editableRef = useRef<HTMLDivElement | null>(null);

  const [mocks] = useState(() => ({
    removeChipMock: vi.fn(),
    dispatchMock: vi.fn(),
    enqueueSnackbarMock: vi.fn(),
    openMentionPickerMock: vi.fn(),
    openHelpPopupMock: vi.fn(),
  }));

  const smartRef = useRef<SmartTextareaHandle>({
    getValue: () => ({ text: '', chip: null }),
    insertChip: vi.fn(),
    removeChip: mocks.removeChipMock,
    clear: vi.fn(),
    focus: vi.fn(),
    getEditableElement: () => editableRef.current,
  });

  const getCommandContext = (): CommandContext => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dispatch: mocks.dispatchMock as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enqueueSnackbar: mocks.enqueueSnackbarMock as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    t: ((k: string) => k) as any,
    openMentionPicker: mocks.openMentionPickerMock,
    openHelpPopup: mocks.openHelpPopupMock,
    removeChip: mocks.removeChipMock,
    ...ctxOverride,
  });

  const { paletteProps } = useCommandTrigger({
    smartTextareaRef: smartRef,
    getCommandContext,
  });

  useImperativeHandle(ref, () => ({
    paletteProps,
    removeChipMock: mocks.removeChipMock,
    dispatchMock: mocks.dispatchMock,
    enqueueSnackbarMock: mocks.enqueueSnackbarMock,
    getEditable: () => editableRef.current as HTMLDivElement,
  }));

  return (
    <div
      ref={editableRef}
      contentEditable
      suppressContentEditableWarning
      data-testid="cmd-harness-editable"
    />
  );
});

/** Place a collapsed selection at offset `n` of the editable's first child. */
const placeCaret = (editable: HTMLDivElement, n: number) => {
  // Ensure there's a text node we can place caret in. If empty, append one.
  if (!editable.firstChild) {
    editable.appendChild(document.createTextNode(''));
  }
  const text = editable.firstChild as Text;
  const sel = window.getSelection();
  const range = document.createRange();
  range.setStart(text, Math.min(n, text.nodeValue?.length ?? 0));
  range.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const flushRaf = async () => {
  await act(async () => {
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  });
};

/**
 * Simulate the browser's two-phase `/` insertion:
 *  1. user is in `preText` with caret at `preTextLen`
 *  2. fires keydown('/') — hook reads pre-state and decides if allowed
 *  3. browser inserts `/`, caret advances to preTextLen+1
 *  4. rAF fires, hook reads post-state and opens palette
 *
 * `preText` should NOT contain the trailing `/`.
 */
const simulateSlashKeystroke = async (
  editable: HTMLDivElement,
  preText: string = '',
) => {
  // Set up pre-state.
  editable.innerHTML = '';
  const node = document.createTextNode(preText);
  editable.appendChild(node);
  placeCaret(editable, preText.length);

  // Fire keydown — hook captures pre-state.
  fireEvent.keyDown(editable, { key: '/' });

  // Simulate browser inserting the slash + advancing caret.
  node.nodeValue = preText + '/';
  placeCaret(editable, preText.length + 1);
  // Fire input so hook can re-evaluate (mostly for the OPEN-state path).
  fireEvent.input(editable);

  // Flush rAF — hook reads post-state and opens.
  await flushRaf();
};

describe('useCommandTrigger (PROJ-20 Phase 3.5)', () => {
  it('initial state: palette closed, empty query', () => {
    const ref = createRef<HarnessHandle>();
    render(<Harness ref={ref} />);
    expect(ref.current?.paletteProps.open).toBe(false);
    expect(ref.current?.paletteProps.query).toBe('');
  });

  it('typing "/" at start of empty editor opens the palette with all 6 commands', async () => {
    // PROJ-20 refactor: registry trimmed to 6 — /auto and /web collapsed into /chat.
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);

    expect(ref.current?.paletteProps.open).toBe(true);
    expect(ref.current?.paletteProps.query).toBe('');
    expect(ref.current?.paletteProps.commands).toHaveLength(6);
  });

  it('typing "/" mid-word does NOT open the palette', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    // Pre-text "abc" — caret at end. The `/` would land after `c` which is
    // not whitespace → palette must NOT open.
    await simulateSlashKeystroke(editable, 'abc');

    expect(ref.current?.paletteProps.open).toBe(false);
  });

  it('typing "/" after a space DOES open the palette', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    // "hello " — `/` lands after a space.
    await simulateSlashKeystroke(editable, 'hello ');

    expect(ref.current?.paletteProps.open).toBe(true);
  });

  it('Escape closes the palette', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);
    expect(ref.current?.paletteProps.open).toBe(true);

    fireEvent.keyDown(editable, { key: 'Escape' });
    expect(ref.current?.paletteProps.open).toBe(false);
  });

  it('Space terminates the slash token and closes', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);
    expect(ref.current?.paletteProps.open).toBe(true);

    fireEvent.keyDown(editable, { key: ' ' });
    expect(ref.current?.paletteProps.open).toBe(false);
  });

  it('onSelect executes /chat: dispatches setModeOverride + snackbar; palette closes', async () => {
    // PROJ-20 refactor: /auto + /web → /chat.
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);
    const cmds = ref.current?.paletteProps.commands ?? [];
    const chat = cmds.find((c) => c.name === 'chat')!;
    expect(chat).toBeDefined();

    act(() => {
      ref.current?.paletteProps.onSelect(chat);
    });

    expect(ref.current?.dispatchMock).toHaveBeenCalled();
    const action = ref.current?.dispatchMock.mock.calls[0][0];
    expect(action.type).toBe('chatBar/setModeOverride');
    expect(action.payload).toBe('chat');
    expect(ref.current?.paletteProps.open).toBe(false);
  });

  it('onSelect executes /clear-context: removeChip called', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);
    const cmds = ref.current?.paletteProps.commands ?? [];
    const clr = cmds.find((c) => c.name === 'clear-context')!;

    act(() => {
      ref.current?.paletteProps.onSelect(clr);
    });

    expect(ref.current?.removeChipMock).toHaveBeenCalled();
    expect(ref.current?.paletteProps.open).toBe(false);
  });

  it('selecting a command strips the /cmd token from the editor', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    // Open palette via simulated `/` keystroke (empty editor).
    await simulateSlashKeystroke(editable);
    expect(ref.current?.paletteProps.open).toBe(true);

    // Simulate user typing "cha" — extend the text node + fire input so the
    // hook re-evaluates the query. PROJ-20 refactor: /chat replaced /auto.
    const txt = editable.firstChild as Text;
    txt.nodeValue = '/cha';
    placeCaret(editable, 4);
    fireEvent.input(editable);

    // Pick /chat.
    const cmds = ref.current?.paletteProps.commands ?? [];
    const chat = cmds.find((c) => c.name === 'chat')!;
    act(() => {
      ref.current?.paletteProps.onSelect(chat);
    });

    // The `/cha` slice should have been stripped by the hook.
    expect(editable.textContent).toBe('');
  });

  it('typing "/help" then selecting fires openHelpPopup (no dispatch)', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);

    const cmds = ref.current?.paletteProps.commands ?? [];
    const help = cmds.find((c) => c.name === 'help')!;
    act(() => {
      ref.current?.paletteProps.onSelect(help);
    });

    expect(ref.current?.paletteProps.open).toBe(false);
    // help doesn't dispatch (it opens a modal); dispatchMock untouched.
    expect(ref.current?.dispatchMock).not.toHaveBeenCalled();
  });

  it('Enter on open palette executes the active command', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} />);
    const editable = getByTestId('cmd-harness-editable') as HTMLDivElement;

    await simulateSlashKeystroke(editable);
    expect(ref.current?.paletteProps.open).toBe(true);

    // activeIndex=0 → /chat by registry order (PROJ-20 refactor: /auto removed).
    fireEvent.keyDown(editable, { key: 'Enter' });
    expect(ref.current?.dispatchMock).toHaveBeenCalled();
    const action = ref.current?.dispatchMock.mock.calls[0][0];
    expect(action.payload).toBe('chat');
    expect(ref.current?.paletteProps.open).toBe(false);
  });
});
