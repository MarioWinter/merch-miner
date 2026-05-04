import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import DesignCardTagEditor from '../partials/grid/DesignCardTagEditor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getInput = () =>
  screen.getByRole('combobox', { name: /edit design tags/i }) as HTMLInputElement;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DesignCardTagEditor', () => {
  it('renders initial tags as chips and focuses the input on mount', async () => {
    renderWithProviders(
      <DesignCardTagEditor
        initialTags={['funny', 'retro']}
        onCommit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('funny')).toBeInTheDocument();
    expect(screen.getByText('retro')).toBeInTheDocument();

    // Wait a microtask for the setTimeout(0) autofocus.
    await new Promise((r) => setTimeout(r, 10));
    expect(document.activeElement).toBe(getInput());
  });

  it('adds a new chip when Enter is pressed with a non-empty, unique value', () => {
    const onCommit = vi.fn();
    renderWithProviders(
      <DesignCardTagEditor
        initialTags={['funny']}
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );

    const input = getInput();
    fireEvent.change(input, { target: { value: 'retro' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('retro')).toBeInTheDocument();
  });

  it('rejects duplicate tags — no new chip added, no extra commit', () => {
    const onCommit = vi.fn();
    renderWithProviders(
      <DesignCardTagEditor
        initialTags={['funny']}
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );

    const input = getInput();
    fireEvent.change(input, { target: { value: 'funny' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Still exactly one chip with label "funny".
    expect(screen.getAllByText('funny')).toHaveLength(1);
  });

  it('fires onCancel when Escape is pressed and does not commit', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <DesignCardTagEditor
        initialTags={['funny']}
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );

    const input = getInput();
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('fires onCommit with the current tags on blur', () => {
    const onCommit = vi.fn();
    renderWithProviders(
      <DesignCardTagEditor
        initialTags={['funny']}
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );

    const input = getInput();
    fireEvent.change(input, { target: { value: 'retro' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(['funny', 'retro']);
  });
});
