/**
 * FIX-ai-research-like-and-notes-editor — Phase 6
 *
 * End-to-end integration tests that exercise the editor as a whole — the
 * slash menu, Enter-continuation, Tab switching, and the Preview checkbox
 * round-trip. Each capability is unit-tested in its own file; these tests
 * verify the parts cooperate.
 */
import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/utils/test-utils';
import NotesMarkdownEditor from '../index';

interface HarnessProps {
  initial?: string;
  onChange?: (next: string) => void;
}

const Harness = ({ initial = '', onChange }: HarnessProps) => {
  const [value, setValue] = useState(initial);
  return (
    <NotesMarkdownEditor
      value={value}
      onChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
      ariaLabel="notes-textarea"
    />
  );
};

const getTextarea = () =>
  screen.getByLabelText('notes-textarea') as HTMLTextAreaElement;

const flush = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
    await new Promise((r) => setTimeout(r, 20));
  });
};

const typeSlash = (ta: HTMLTextAreaElement) => {
  act(() => {
    fireEvent.keyDown(ta, { key: '/' });
    fireEvent.change(ta, { target: { value: ta.value + '/' } });
  });
};

describe('NotesMarkdownEditor integration', () => {
  it('chains slash insert + Enter continuation + empty-prefix escape (AC-B9, B11, B12)', async () => {
    renderWithProviders(<Harness />);
    const ta = getTextarea();

    // Step 1: type `/` to open menu
    ta.focus();
    typeSlash(ta);
    await flush();
    ta.setSelectionRange(1, 1);
    await flush();
    expect(screen.getByTestId('notes-editor-slash-menu-paper')).toBeInTheDocument();

    // Step 2: Enter selects the first row (Bulleted list)
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    await flush();
    expect(ta.value).toBe('- ');

    // Step 3: type 'foo' (simulate the user appending content)
    act(() => {
      fireEvent.change(ta, { target: { value: '- foo' } });
    });
    ta.setSelectionRange(5, 5);
    await flush();

    // Step 4: Enter at end of `- foo` continues the bullet (AC-B11)
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    await flush();
    expect(ta.value).toBe('- foo\n- ');

    // Step 5: Enter on the empty bullet line removes the prefix (AC-B12 / EC-B4)
    ta.setSelectionRange(ta.value.length, ta.value.length);
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    await flush();
    // The escape pattern strips the `- ` prefix from the empty line.
    expect(ta.value).toBe('- foo\n');
  });

  it('switching Edit ↔ Preview preserves value without firing onChange (EC-B17)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <Harness initial={'- task one\n- [ ] task two'} onChange={onChange} />,
    );

    // Edit is default
    const editTab = screen.getByRole('tab', { name: /edit/i });
    const previewTab = screen.getByRole('tab', { name: /preview/i });
    expect(editTab).toHaveAttribute('aria-selected', 'true');

    // Click Preview
    await user.click(previewTab);
    expect(previewTab).toHaveAttribute('aria-selected', 'true');

    // Preview rendered the list — assert <li> + checkbox both present
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(1);

    // Click back to Edit
    await user.click(editTab);
    expect(editTab).toHaveAttribute('aria-selected', 'true');

    // Textarea still shows the original value
    expect(getTextarea().value).toBe('- task one\n- [ ] task two');

    // onChange must not have been fired by tab clicks alone
    expect(onChange).not.toHaveBeenCalled();
  });

  it('clicking the Preview checkbox toggles markdown and round-trips to Edit (AC-B14, EC-B3)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(<Harness initial={'- [ ] todo'} onChange={onChange} />);

    // Switch to Preview
    await user.click(screen.getByRole('tab', { name: /preview/i }));
    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    // Click — fires onChange with the toggled markdown
    await user.click(checkbox);
    expect(onChange).toHaveBeenCalledWith('- [x] todo');

    // Switch back to Edit and verify the textarea reflects the toggled value
    await user.click(screen.getByRole('tab', { name: /edit/i }));
    expect(getTextarea().value).toBe('- [x] todo');
  });
});
