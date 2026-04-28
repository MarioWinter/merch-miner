/**
 * PROJ-20 Phase 3.5 — CommandPalette tests
 *
 * Strategy: render the palette directly with stable props (no useCommandTrigger).
 * Floating-UI portal mounts into document.body; we query by testid.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import CommandPalette from '../partials/CommandPalette';
import { COMMANDS } from '../utils/commandRegistry';

const baseRect = new DOMRect(100, 200, 0, 20);

const baseProps = {
  open: true,
  anchorRect: baseRect,
  query: '',
  commands: COMMANDS,
  activeIndex: 0,
  onSelect: vi.fn(),
  onClose: vi.fn(),
  onHoverIndex: vi.fn(),
};

describe('CommandPalette (PROJ-20 Phase 3.5)', () => {
  it('renders nothing when closed', () => {
    renderWithProviders(<CommandPalette {...baseProps} open={false} />);
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument();
  });

  it('renders all 6 commands when open with empty query', () => {
    // PROJ-20 refactor: registry trimmed to 6 — /auto and /web were collapsed
    // into the single /chat command.
    renderWithProviders(<CommandPalette {...baseProps} />);
    expect(screen.getByTestId('command-palette')).toBeInTheDocument();
    COMMANDS.forEach((cmd) => {
      expect(screen.getByText(cmd.trigger)).toBeInTheDocument();
    });
  });

  it('highlights the active row via aria-selected', () => {
    renderWithProviders(<CommandPalette {...baseProps} activeIndex={2} />);
    const active = screen.getByTestId('command-palette-row-2');
    expect(active).toHaveAttribute('aria-selected', 'true');
    const other = screen.getByTestId('command-palette-row-0');
    expect(other).toHaveAttribute('aria-selected', 'false');
  });

  it('calls onSelect when a row is clicked', () => {
    const onSelect = vi.fn();
    renderWithProviders(
      <CommandPalette {...baseProps} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('command-palette-row-1'));
    expect(onSelect).toHaveBeenCalledWith(COMMANDS[1]);
  });

  it('calls onHoverIndex on row hover', () => {
    const onHoverIndex = vi.fn();
    renderWithProviders(
      <CommandPalette {...baseProps} onHoverIndex={onHoverIndex} />,
    );
    fireEvent.mouseEnter(screen.getByTestId('command-palette-row-3'));
    expect(onHoverIndex).toHaveBeenCalledWith(3);
  });

  it('shows empty-state when commands list is empty', () => {
    renderWithProviders(
      <CommandPalette {...baseProps} commands={[]} query="zzz" />,
    );
    expect(screen.getByTestId('command-palette-empty')).toBeInTheDocument();
    expect(screen.getByText(/No matching commands/)).toBeInTheDocument();
  });

  it('Escape key on the palette calls onClose', () => {
    const onClose = vi.fn();
    renderWithProviders(<CommandPalette {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(screen.getByTestId('command-palette'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders the description for each command', () => {
    renderWithProviders(<CommandPalette {...baseProps} />);
    // EN locale strings — rendered via t() via the test i18n setup.
    // PROJ-20 refactor: /auto + /web → single /chat command.
    expect(screen.getByText('Switch to Chat mode')).toBeInTheDocument();
    expect(screen.getByText('Switch to Agent mode')).toBeInTheDocument();
  });
});
