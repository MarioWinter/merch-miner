/**
 * PROJ-20 Phase 3.2 — SmartTextarea integration tests.
 *
 * Notes on jsdom limits: Selection/Range support is partial. Tests that
 * depend on real caret positioning either drive the underlying logic
 * directly (Backspace guard hook) or accept that user-event typing won't
 * dispatch a real `input` event with full caret semantics. Where that
 * matters, we manipulate the DOM directly and dispatch synthetic events.
 */
import { createRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import SmartTextarea, {
  type SmartTextareaHandle,
} from '../SmartTextarea';

const renderSmart = (
  props: Partial<React.ComponentProps<typeof SmartTextarea>> = {},
) => {
  const ref = createRef<SmartTextareaHandle>();
  const onValueChange = vi.fn();
  const onSubmit = vi.fn();
  const utils = renderWithProviders(
    <SmartTextarea
      ref={ref}
      appearance="panel"
      placeholder="Ask anything"
      onValueChange={onValueChange}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return {
    ref,
    onValueChange,
    onSubmit,
    editable: screen.getByTestId('chat-input-editable') as HTMLDivElement,
    ...utils,
  };
};

describe('SmartTextarea (PROJ-20 Phase 3.2)', () => {
  it('renders empty editable with placeholder visible (data-has-content="false")', () => {
    const { editable } = renderSmart();
    expect(editable.getAttribute('data-has-content')).toBe('false');
    expect(editable.getAttribute('data-placeholder')).toBe('Ask anything');
    expect(editable.getAttribute('contenteditable')).toBe('true');
  });

  it('typing text updates value via onValueChange and toggles data-has-content', async () => {
    const { editable, onValueChange } = renderSmart();

    // jsdom user-event typing into a contenteditable div is unreliable;
    // simulate by mutating the DOM and firing the input event ourselves.
    editable.textContent = 'hello';
    fireEvent.input(editable);

    expect(editable.getAttribute('data-has-content')).toBe('true');
    expect(onValueChange).toHaveBeenCalled();
    const last = onValueChange.mock.calls.at(-1)?.[0];
    expect(last).toEqual({ text: 'hello', chip: null });
  });

  it('insertChip mounts a chip with data attributes and triggers onValueChange', () => {
    const { ref, editable, onValueChange } = renderSmart();

    act(() => {
      ref.current?.insertChip({ niche_id: 'n-1', niche_name: 'Halloween' });
    });

    const chip = editable.querySelector(
      '[data-niche-chip]',
    ) as HTMLElement | null;
    expect(chip).not.toBeNull();
    expect(chip?.dataset.nicheId).toBe('n-1');
    expect(chip?.dataset.nicheName).toBe('Halloween');
    expect(chip?.getAttribute('contenteditable')).toBe('false');
    expect(editable.getAttribute('data-has-content')).toBe('true');
    const last = onValueChange.mock.calls.at(-1)?.[0];
    expect(last.chip).toEqual({ niche_id: 'n-1', niche_name: 'Halloween' });
  });

  it('insertChip a second time replaces the existing chip (single chip rule)', () => {
    const { ref, editable } = renderSmart();
    act(() => {
      ref.current?.insertChip({ niche_id: 'n-1', niche_name: 'A' });
    });
    act(() => {
      ref.current?.insertChip({ niche_id: 'n-2', niche_name: 'B' });
    });
    const chips = editable.querySelectorAll('[data-niche-chip]');
    expect(chips.length).toBe(1);
    expect((chips[0] as HTMLElement).dataset.nicheId).toBe('n-2');
    expect((chips[0] as HTMLElement).dataset.nicheName).toBe('B');
  });

  it('clicking the ✕ inside the chip removes it and fires onValueChange chip:null', () => {
    const { ref, editable, onValueChange } = renderSmart();
    act(() => {
      ref.current?.insertChip({ niche_id: 'n-1', niche_name: 'Halloween' });
    });
    const removeBtn = editable.querySelector(
      '[data-chip-remove]',
    ) as HTMLButtonElement;
    expect(removeBtn).not.toBeNull();
    fireEvent.click(removeBtn);

    expect(editable.querySelector('[data-niche-chip]')).toBeNull();
    const last = onValueChange.mock.calls.at(-1)?.[0];
    expect(last.chip).toBeNull();
  });

  it('Backspace at the very start of the text right after a chip removes the chip', () => {
    const { ref, editable } = renderSmart();
    act(() => {
      ref.current?.insertChip({ niche_id: 'n-1', niche_name: 'Halloween' });
    });

    // After insertChip, a trailing text node " " was inserted. Place a
    // collapsed selection at offset 0 of that text node — this is the
    // boundary the Backspace guard targets.
    const chip = editable.querySelector('[data-niche-chip]') as HTMLElement;
    const after = chip.nextSibling as Text | null;
    expect(after).not.toBeNull();

    const range = document.createRange();
    range.setStart(after as Text, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    fireEvent.keyDown(editable, { key: 'Backspace' });

    expect(editable.querySelector('[data-niche-chip]')).toBeNull();
  });

  it('Enter without Shift fires onSubmit and prevents newline', () => {
    const { editable, onSubmit } = renderSmart();
    const event = fireEvent.keyDown(editable, {
      key: 'Enter',
      shiftKey: false,
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // fireEvent returns false when preventDefault was called.
    expect(event).toBe(false);
  });

  it('Shift+Enter does NOT fire onSubmit (browser inserts newline natively)', () => {
    const { editable, onSubmit } = renderSmart();
    fireEvent.keyDown(editable, { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('clear() empties the editor and resets the placeholder state', () => {
    const { ref, editable, onValueChange } = renderSmart();
    act(() => {
      ref.current?.insertChip({ niche_id: 'n-1', niche_name: 'X' });
    });
    expect(editable.getAttribute('data-has-content')).toBe('true');

    act(() => {
      ref.current?.clear();
    });

    expect(editable.innerHTML).toBe('');
    expect(editable.getAttribute('data-has-content')).toBe('false');
    const last = onValueChange.mock.calls.at(-1)?.[0];
    expect(last).toEqual({ text: '', chip: null });
  });

  it('focus() moves focus into the editable element', () => {
    const { ref, editable } = renderSmart();
    act(() => {
      ref.current?.focus();
    });
    expect(document.activeElement).toBe(editable);
  });

  it('getValue() returns the current parsed value', () => {
    const { ref, editable } = renderSmart();
    editable.textContent = 'hello world';
    fireEvent.input(editable);
    const value = ref.current?.getValue();
    expect(value).toEqual({ text: 'hello world', chip: null });
  });

  // Real keyboard-driven typing of arbitrary characters into a
  // contenteditable in jsdom is unreliable for caret-positioning checks;
  // the Playwright suite (Phase 6) will cover end-to-end keystrokes.
  it.skip('typed characters via userEvent update the editable (jsdom limitation)', async () => {
    const user = userEvent.setup();
    const { editable } = renderSmart();
    editable.focus();
    await user.type(editable, 'abc');
    expect(editable.textContent).toContain('abc');
  });
});
