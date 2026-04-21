import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import ActionBar from '../partials/ActionBar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeProps = (overrides: Record<string, unknown> = {}) => ({
  selectionCount: 0,
  allSelected: false,
  onEdit: vi.fn(),
  onToggleAll: vi.fn(),
  onHistory: vi.fn(),
  onBatchUpload: vi.fn(),
  onDelete: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ActionBar', () => {
  it('does not render the toolbar when selectionCount=0', () => {
    renderWithProviders(<ActionBar {...makeProps()} />);

    // The MUI <Slide mountOnEnter unmountOnExit> pulls the Dock out of the
    // tree entirely while `open` is false — no role=toolbar node at all.
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('renders the dock with the counter visible when selectionCount>0', () => {
    renderWithProviders(<ActionBar {...makeProps({ selectionCount: 3 })} />);

    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
    // Counter pill shows the raw selection count as text.
    expect(toolbar).toHaveTextContent('3');
    // Buttons rendered by the dock (desktop layout — default jsdom width).
    expect(
      screen.getByRole('button', { name: /^edit$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /^delete$/i }),
    ).toBeInTheDocument();
  });

  it('fires onEdit and onDelete when their buttons are clicked', () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    renderWithProviders(
      <ActionBar
        {...makeProps({ selectionCount: 2, onEdit, onDelete })}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
