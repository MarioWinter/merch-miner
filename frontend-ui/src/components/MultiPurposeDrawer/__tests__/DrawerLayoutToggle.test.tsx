import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';

import { renderWithProviders } from '../../../utils/test-utils';
import DrawerLayoutToggle from '../DrawerLayoutToggle';
import chatBarReducer, { openDrawer } from '@/store/chatBarSlice';

// Layout toggle is desktop-only — keep matchMedia honest.
vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
  matches: false,
  media: '',
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// PROJ-30 T2.8 — DrawerLayoutToggle now hides on !isDesktop; force desktop.
vi.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    isPhoneTiny: false,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));

describe('DrawerLayoutToggle', () => {
  const reducers = { chatBar: chatBarReducer };

  it('does not render the toggle when drawer is closed', () => {
    renderWithProviders(<DrawerLayoutToggle />, { reducers });
    // ToggleWrap fades to opacity:0 when drawer is closed — assert by
    // checking the wrapper opacity flag. The button is still mounted but
    // visually hidden; we settle for "no visible toggle text" semantics by
    // checking opacity.
    const btn = screen.queryByTestId('mpd-layout-toggle');
    // Button mounts regardless; wrapper opacity expresses visibility.
    expect(btn).toBeInTheDocument();
    const wrap = btn?.closest('.mpd-layout-toggle');
    expect(wrap).toHaveStyle({ opacity: '0' });
  });

  it('shows the toggle when drawer is open and flips drawerLayout on click', () => {
    const { store } = renderWithProviders(<DrawerLayoutToggle />, {
      reducers,
    });
    store.dispatch(openDrawer('chat'));
    const btn = screen.getByTestId('mpd-layout-toggle');
    expect(btn).toBeInTheDocument();

    // Initial layout is overlap.
    expect(store.getState().chatBar.drawerLayout).toBe('overlap');
    fireEvent.click(btn);
    expect(store.getState().chatBar.drawerLayout).toBe('sideBySide');
    fireEvent.click(btn);
    expect(store.getState().chatBar.drawerLayout).toBe('overlap');
  });
});
