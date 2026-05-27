/**
 * FIX-ai-research-like-and-notes-editor — Phase 4C
 *
 * Unit tests for the Enter-continuation hook. Verifies the continuation
 * pattern for bulleted / to-do / numbered lists and the escape pattern on
 * an empty list-prefix-only line (AC-B11, AC-B12, EC-B4).
 */
import { useRef, useState } from 'react';
import { act, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/utils/test-utils';
import { useListContinuation } from '../hooks/useListContinuation';

interface HarnessProps {
  initial: string;
  caretPos: number;
  enabled?: boolean;
}

const Harness = ({ initial, caretPos, enabled = true }: HarnessProps) => {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  useListContinuation({
    textareaRef: ref,
    value,
    onChange: setValue,
    enabled,
  });
  // Set the caret synchronously once on mount via callback ref.
  const setRef = (el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (el) {
      el.focus();
      el.setSelectionRange(caretPos, caretPos);
    }
  };
  return (
    <textarea
      ref={setRef}
      data-testid="ta"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
};

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
};

describe('useListContinuation', () => {
  it('continues a bulleted list on Enter at end of `- foo`', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="- foo" caretPos={5} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    expect(ta.value).toBe('- foo\n- ');
  });

  it('continues a to-do list on Enter at end of `- [ ] task`', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="- [ ] task" caretPos={10} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    expect(ta.value).toBe('- [ ] task\n- [ ] ');
  });

  it('continues a checked to-do as an UNCHECKED new line', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="- [x] done" caretPos={10} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    expect(ta.value).toBe('- [x] done\n- [ ] ');
  });

  it('continues a numbered list with incremented N', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="1. foo" caretPos={6} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    expect(ta.value).toBe('1. foo\n2. ');
  });

  it('escapes on an empty bulleted line — removes prefix, inserts blank line', async () => {
    // value = '- ', caret at end → empty content after prefix
    const { getByTestId } = renderWithProviders(
      <Harness initial="- " caretPos={2} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    expect(ta.value).toBe('');
  });

  it('escapes on an empty to-do line', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="- [ ] " caretPos={6} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    expect(ta.value).toBe('');
  });

  it('does nothing when disabled (slash menu open)', async () => {
    const { getByTestId } = renderWithProviders(
      <Harness initial="- foo" caretPos={5} enabled={false} />,
    );
    const ta = getByTestId('ta') as HTMLTextAreaElement;
    fireEvent.keyDown(ta, { key: 'Enter' });
    await flush();
    // No mutation — Enter goes through to browser default.
    expect(ta.value).toBe('- foo');
  });
});
