/**
 * FIX-ai-research-like-and-notes-editor — Phase 4F
 *
 * Component-level integration tests for the slash-menu wired into the
 * NotesMarkdownEditor's Edit textarea. Tests rely on the editor mounting
 * the textarea + Popper menu together.
 */
import { useState } from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/utils/test-utils';
import NotesMarkdownEditor from '../index';

interface HarnessProps {
  initial?: string;
}

const Harness = ({ initial = '' }: HarnessProps) => {
  const [value, setValue] = useState(initial);
  return (
    <NotesMarkdownEditor
      value={value}
      onChange={setValue}
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

describe('NotesMarkdownEditor slash menu', () => {
  it('does not render the menu before any `/` is typed', () => {
    renderWithProviders(<Harness />);
    expect(screen.queryByTestId('notes-editor-slash-menu-paper')).toBeNull();
  });

  it('opens the menu and shows all 15 commands on `/`', async () => {
    renderWithProviders(<Harness />);
    const ta = getTextarea();
    ta.focus();
    typeSlash(ta);
    await flush();
    ta.setSelectionRange(1, 1);
    await flush();
    expect(
      screen.getByTestId('notes-editor-slash-menu-paper'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('option').length).toBe(15);
  });

  it('filters the menu when the user types after `/`', async () => {
    renderWithProviders(<Harness />);
    const ta = getTextarea();
    ta.focus();
    typeSlash(ta);
    await flush();
    ta.setSelectionRange(1, 1);
    await flush();

    // Simulate typing 'bu' after `/`.
    act(() => {
      fireEvent.change(ta, { target: { value: '/bu' } });
    });
    await flush();
    ta.setSelectionRange(3, 3);
    fireEvent.input(ta);
    await flush();

    const options = screen.getAllByRole('option');
    expect(options.length).toBeLessThan(15);
    const labels = options.map((o) => o.textContent ?? '');
    expect(labels.some((l) => l.includes('Bulleted list'))).toBe(true);
  });

  it('inserts `- ` when Enter is pressed on the first row (Bulleted list)', async () => {
    renderWithProviders(<Harness />);
    const ta = getTextarea();
    ta.focus();
    typeSlash(ta);
    await flush();
    ta.setSelectionRange(1, 1);
    await flush();

    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    await flush();
    expect(ta.value).toBe('- ');
    expect(screen.queryByTestId('notes-editor-slash-menu-paper')).toBeNull();
  });

  it('does NOT open the menu when `/` is typed mid-word (EC-B5)', async () => {
    renderWithProviders(<Harness initial="and" />);
    const ta = getTextarea();
    ta.focus();
    ta.setSelectionRange(3, 3);
    fireEvent.keyDown(ta, { key: '/' });
    act(() => {
      fireEvent.change(ta, { target: { value: 'and/' } });
    });
    await flush();
    expect(screen.queryByTestId('notes-editor-slash-menu-paper')).toBeNull();
  });

  it('Escape closes the menu and leaves `/` in the textarea (AC-B10)', async () => {
    renderWithProviders(<Harness />);
    const ta = getTextarea();
    ta.focus();
    typeSlash(ta);
    await flush();
    ta.setSelectionRange(1, 1);
    await flush();
    act(() => {
      fireEvent.keyDown(ta, { key: 'Escape' });
    });
    await flush();
    expect(screen.queryByTestId('notes-editor-slash-menu-paper')).toBeNull();
    expect(ta.value).toBe('/');
  });

  it('continues a bulleted list on Enter at end of `- foo` (AC-B11)', async () => {
    renderWithProviders(<Harness initial="- foo" />);
    const ta = getTextarea();
    ta.focus();
    ta.setSelectionRange(5, 5);
    act(() => {
      fireEvent.keyDown(ta, { key: 'Enter' });
    });
    await flush();
    expect(ta.value).toBe('- foo\n- ');
  });
});
