/**
 * FIX-ai-research-like-and-notes-editor — Phase 5
 *
 * Unit tests for the Preview-mode markdown renderer. Covers:
 *   - GFM lists / headings / blockquote rendering (AC-B13)
 *   - All four GitHub-alert callout types render with their class names
 *     (Decision-6, AC-B18)
 *   - Unknown alert type falls back to plain blockquote (EC-B19)
 *   - Empty / whitespace-only value shows the placeholder (EC-B1, EC-B2)
 *   - Interactive GFM checkboxes round-trip through onChange (AC-B14, EC-B3)
 *   - Multi-line paste with callouts renders correctly (EC-B18)
 */
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/utils/test-utils';
import NotesMarkdownRenderer from '../partials/NotesMarkdownRenderer';

describe('NotesMarkdownRenderer', () => {
  it('renders a bulleted list', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'- foo\n- bar'} onChange={() => {}} />,
    );
    const items = container.querySelectorAll('ul > li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('foo');
  });

  it('renders a numbered list', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'1. foo\n2. bar'} onChange={() => {}} />,
    );
    const items = container.querySelectorAll('ol > li');
    expect(items.length).toBe(2);
  });

  it('renders a heading', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'# Title'} onChange={() => {}} />,
    );
    const heading = container.querySelector('h1');
    expect(heading?.textContent).toBe('Title');
  });

  it('renders a plain blockquote', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'> quote'} onChange={() => {}} />,
    );
    expect(container.querySelector('blockquote')).not.toBeNull();
    // A plain blockquote must not carry the alert class.
    expect(container.querySelector('.markdown-alert')).toBeNull();
  });

  it('renders a Note callout', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'> [!NOTE]\n> body'} onChange={() => {}} />,
    );
    expect(container.querySelector('.markdown-alert.markdown-alert-note')).not.toBeNull();
  });

  it('renders a Tip callout', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'> [!TIP]\n> body'} onChange={() => {}} />,
    );
    expect(container.querySelector('.markdown-alert.markdown-alert-tip')).not.toBeNull();
  });

  it('renders a Warning callout', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'> [!WARNING]\n> body'} onChange={() => {}} />,
    );
    expect(container.querySelector('.markdown-alert.markdown-alert-warning')).not.toBeNull();
  });

  it('renders an Important callout', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'> [!IMPORTANT]\n> body'} onChange={() => {}} />,
    );
    expect(container.querySelector('.markdown-alert.markdown-alert-important')).not.toBeNull();
  });

  it('falls back to plain blockquote for an unknown alert type (EC-B19)', () => {
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'> [!CUSTOM]\n> body'} onChange={() => {}} />,
    );
    expect(container.querySelector('blockquote')).not.toBeNull();
    expect(container.querySelector('.markdown-alert')).toBeNull();
  });

  it('shows the placeholder when value is empty (EC-B1)', () => {
    const { container, getByText } = renderWithProviders(
      <NotesMarkdownRenderer value={''} onChange={() => {}} />,
    );
    expect(getByText('No notes yet')).toBeInTheDocument();
    // No markdown structure should be rendered.
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelector('h1')).toBeNull();
    expect(container.querySelector('[data-testid="notes-markdown-renderer"]')).toBeNull();
  });

  it('shows the placeholder when value is whitespace-only (EC-B2)', () => {
    const { getByText } = renderWithProviders(
      <NotesMarkdownRenderer value={'   \n\n   \t '} onChange={() => {}} />,
    );
    expect(getByText('No notes yet')).toBeInTheDocument();
  });

  it('toggles `[ ]` → `[x]` when a checkbox is clicked (AC-B14, EC-B3)', () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'- [ ] task'} onChange={onChange} />,
    );
    const cb = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(cb).not.toBeNull();
    expect(cb.disabled).toBe(false);
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith('- [x] task');
  });

  it('toggles `[x]` → `[ ]` on click (round-trip)', () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={'- [x] task'} onChange={onChange} />,
    );
    const cb = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(cb);
    expect(onChange).toHaveBeenCalledWith('- [ ] task');
  });

  it('toggles only the clicked checkbox when multiple exist', () => {
    const onChange = vi.fn();
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer
        value={'- [ ] one\n- [x] two\n- [ ] three'}
        onChange={onChange}
      />,
    );
    const cbs = container.querySelectorAll('input[type="checkbox"]');
    expect(cbs.length).toBe(3);
    // Click the second one — should toggle [x] → [ ]
    fireEvent.click(cbs[1] as HTMLInputElement);
    expect(onChange).toHaveBeenCalledWith('- [ ] one\n- [ ] two\n- [ ] three');
  });

  it('renders a callout and a bulleted list together (EC-B18)', () => {
    const value = '> [!NOTE]\n> heads up\n\n- item a\n- item b';
    const { container } = renderWithProviders(
      <NotesMarkdownRenderer value={value} onChange={() => {}} />,
    );
    expect(container.querySelector('.markdown-alert-note')).not.toBeNull();
    expect(container.querySelectorAll('ul > li').length).toBe(2);
  });
});
