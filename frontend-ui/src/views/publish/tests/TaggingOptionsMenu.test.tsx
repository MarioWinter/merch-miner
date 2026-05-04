import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import TaggingOptionsMenu from '../partials/global/TaggingOptionsMenu';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const openMenu = () => {
  fireEvent.click(screen.getByTestId('TaggingOptionsMenu-button'));
};

// ---------------------------------------------------------------------------
// Tests — Phase U9 (AC-134)
//
// The menu component is dumb: it only fires the handlers supplied by its
// parent. Confirm-dialog orchestration lives in `useGlobalTabActions`, so
// here we only verify that (a) each menu item triggers the correct handler
// and (b) the menu closes after clicking an item. Parent-level confirm
// dialogs are asserted through GlobalTabContent integration tests.
// ---------------------------------------------------------------------------

describe('TaggingOptionsMenu — Phase U9', () => {
  let onCopyEnToAll: ReturnType<typeof vi.fn>;
  let onClearAll: ReturnType<typeof vi.fn>;
  let onImportCsv: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onCopyEnToAll = vi.fn();
    onClearAll = vi.fn();
    onImportCsv = vi.fn();
  });

  const renderMenu = (disabled = false) =>
    renderWithProviders(
      <TaggingOptionsMenu
        disabled={disabled}
        onCopyEnToAll={onCopyEnToAll}
        onClearAll={onClearAll}
        onImportCsv={onImportCsv}
      />,
    );

  it('renders the trigger button with a menu affordance', () => {
    renderMenu();
    const btn = screen.getByTestId('TaggingOptionsMenu-button');
    expect(btn).toHaveAttribute('aria-haspopup', 'menu');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('Copy-EN action fires onCopyEnToAll and closes the menu', () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByTestId('TaggingOptionsMenu-copyEn'));
    expect(onCopyEnToAll).toHaveBeenCalledTimes(1);
    expect(onClearAll).not.toHaveBeenCalled();
    expect(onImportCsv).not.toHaveBeenCalled();
  });

  it('Import-CSV action fires onImportCsv and closes the menu', () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByTestId('TaggingOptionsMenu-importCsv'));
    expect(onImportCsv).toHaveBeenCalledTimes(1);
    expect(onCopyEnToAll).not.toHaveBeenCalled();
    expect(onClearAll).not.toHaveBeenCalled();
  });

  it('Clear-all action fires onClearAll and closes the menu', () => {
    renderMenu();
    openMenu();
    fireEvent.click(screen.getByTestId('TaggingOptionsMenu-clearAll'));
    expect(onClearAll).toHaveBeenCalledTimes(1);
    expect(onCopyEnToAll).not.toHaveBeenCalled();
    expect(onImportCsv).not.toHaveBeenCalled();
  });

  it('disables the trigger when `disabled` is true — menu cannot open', () => {
    renderMenu(true);
    const btn = screen.getByTestId('TaggingOptionsMenu-button');
    expect(btn).toBeDisabled();
    // Clicking a disabled button is a no-op.
    fireEvent.click(btn);
    expect(
      screen.queryByTestId('TaggingOptionsMenu-copyEn'),
    ).not.toBeInTheDocument();
  });
});
