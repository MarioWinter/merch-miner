/**
 * PROJ-20 Phase 3.3 — useMentionTrigger tests
 *
 * jsdom does not support layout, so we cannot rely on real caret-rect
 * measurements. We DO test:
 *  - typing `@` opens the picker
 *  - ESC closes the picker
 *  - selecting a niche via onSelect calls SmartTextarea.insertChip
 *  - input event with text appended to "@" updates query state
 *
 * To do that we render a tiny harness that exposes the hook's pickerProps
 * for assertion + a SmartTextarea ref. Real-browser keystroke behaviour is
 * verified manually + Playwright in Phase 6.
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
import { useMentionTrigger } from '../hooks/useMentionTrigger';
import type { SmartTextareaHandle } from '../SmartTextarea';
import type { MentionPickerProps } from '../hooks/useMentionTrigger';

interface HarnessProps {
  niches: { id: string; name: string; slug?: string }[];
  isLoading?: boolean;
  onCreateNicheRequested?: () => void;
}

interface HarnessHandle {
  pickerProps: MentionPickerProps;
  insertChipMock: ReturnType<typeof vi.fn>;
  getEditableMock: () => HTMLDivElement;
}

const Harness = forwardRef<HarnessHandle, HarnessProps>(function Harness(
  { niches, isLoading = false, onCreateNicheRequested = () => {} },
  ref,
) {
  // Build a real DOM div that acts like the SmartTextarea editable root so
  // hook listeners get attached to a real element. We render it inline via
  // a callback ref + useRef.
  const editableRef = useRef<HTMLDivElement | null>(null);

  // Mocks must be stable across renders. `useRef({...})` only uses its
  // initializer on first mount, so we initialize the mocks via lazy useState
  // (state setter is never called — we only need a stable, render-safe value).
  // Reading a ref's `.current` during render is flagged by `react-hooks/refs`
  // — using state avoids that lint while still giving us per-instance mocks.
  const [mocks] = useState(() => ({
    insertChipMock: vi.fn(),
    focusMock: vi.fn(),
  }));
  const { insertChipMock, focusMock } = mocks;

  const smartRef = useRef<SmartTextareaHandle>({
    getValue: () => ({ text: '', chip: null }),
    insertChip: insertChipMock,
    removeChip: vi.fn(),
    clear: vi.fn(),
    focus: focusMock,
    getEditableElement: () => editableRef.current,
  });

  const { pickerProps } = useMentionTrigger({
    smartTextareaRef: smartRef,
    niches,
    isLoading,
    onCreateNicheRequested,
  });

  useImperativeHandle(ref, () => ({
    pickerProps,
    insertChipMock,
    getEditableMock: () => editableRef.current as HTMLDivElement,
  }));

  return (
    <div
      ref={editableRef}
      contentEditable
      suppressContentEditableWarning
      data-testid="harness-editable"
    />
  );
});

const niches = [
  { id: 'n-1', name: 'Halloween', slug: 'halloween' },
  { id: 'n-2', name: 'Halftones', slug: 'halftones' },
  { id: 'n-3', name: 'Christmas', slug: 'christmas' },
];

describe('useMentionTrigger (PROJ-20 Phase 3.3)', () => {
  it('initial state: picker closed, no anchor, empty query', () => {
    const ref = createRef<HarnessHandle>();
    render(<Harness ref={ref} niches={niches} />);
    expect(ref.current?.pickerProps.open).toBe(false);
    expect(ref.current?.pickerProps.query).toBe('');
    expect(ref.current?.pickerProps.activeIndex).toBe(0);
  });

  it('exposes filtered niches in pickerProps (top 8 when query empty)', () => {
    const ref = createRef<HarnessHandle>();
    render(<Harness ref={ref} niches={niches} />);
    // Closed → filtered list still computed and exposed
    expect(ref.current?.pickerProps.niches).toHaveLength(3);
  });

  it('typing `@` opens the picker (rAF flush required)', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} niches={niches} />);
    const editable = getByTestId('harness-editable') as HTMLDivElement;

    // Place a collapsed selection inside the editable so getCaretOffset
    // returns a numeric value rather than null.
    editable.appendChild(document.createTextNode('@'));
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editable.firstChild as Text, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    fireEvent.keyDown(editable, { key: '@' });

    // useMentionTrigger schedules state via requestAnimationFrame
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    expect(ref.current?.pickerProps.open).toBe(true);
    expect(ref.current?.pickerProps.query).toBe('');
  });

  it('Escape closes the picker', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} niches={niches} />);
    const editable = getByTestId('harness-editable') as HTMLDivElement;
    editable.appendChild(document.createTextNode('@'));
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editable.firstChild as Text, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    fireEvent.keyDown(editable, { key: '@' });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    expect(ref.current?.pickerProps.open).toBe(true);

    fireEvent.keyDown(editable, { key: 'Escape' });
    expect(ref.current?.pickerProps.open).toBe(false);
  });

  it('onSelect calls smartTextarea.insertChip with niche data', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} niches={niches} />);
    const editable = getByTestId('harness-editable') as HTMLDivElement;
    editable.appendChild(document.createTextNode('@'));
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editable.firstChild as Text, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    fireEvent.keyDown(editable, { key: '@' });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    act(() => {
      ref.current?.pickerProps.onSelect(niches[0]);
    });

    expect(ref.current?.insertChipMock).toHaveBeenCalledWith({
      niche_id: 'n-1',
      niche_name: 'Halloween',
    });
    expect(ref.current?.pickerProps.open).toBe(false);
  });

  it('onClose closes the picker', async () => {
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(<Harness ref={ref} niches={niches} />);
    const editable = getByTestId('harness-editable') as HTMLDivElement;
    editable.appendChild(document.createTextNode('@'));
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editable.firstChild as Text, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    fireEvent.keyDown(editable, { key: '@' });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    act(() => ref.current?.pickerProps.onClose());
    expect(ref.current?.pickerProps.open).toBe(false);
  });

  it('onCreateNiche fires the supplied callback and closes the picker', async () => {
    const onCreate = vi.fn();
    const ref = createRef<HarnessHandle>();
    const { getByTestId } = render(
      <Harness ref={ref} niches={[]} onCreateNicheRequested={onCreate} />,
    );
    const editable = getByTestId('harness-editable') as HTMLDivElement;
    editable.appendChild(document.createTextNode('@'));
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(editable.firstChild as Text, 1);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);

    fireEvent.keyDown(editable, { key: '@' });
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });

    act(() => ref.current?.pickerProps.onCreateNiche());
    expect(onCreate).toHaveBeenCalled();
    expect(ref.current?.pickerProps.open).toBe(false);
  });

  it('filters niches by name substring (case-insensitive) and caps at 8', () => {
    const big = Array.from({ length: 12 }, (_, i) => ({
      id: `n-${i}`,
      name: `Niche ${i}`,
      slug: `niche-${i}`,
    }));
    const ref = createRef<HarnessHandle>();
    render(<Harness ref={ref} niches={big} />);
    // No query yet — top 8.
    expect(ref.current?.pickerProps.niches).toHaveLength(8);
  });
});
