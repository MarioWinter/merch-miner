/**
 * PROJ-30 T2.3 — HamburgerMenu tests.
 *
 * Strategy: mock `useResponsiveLayout` directly so tests don't depend on
 * `matchMedia` in JSDOM. Sidebar is stubbed because it requires the full
 * navigation stack (i18n routes, redux nav config).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockLayout = vi.fn();

vi.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => mockLayout(),
}));

// Stub Sidebar — its internals (navConfig, useNavigate dependencies) aren't
// what we're testing here; we just need a discoverable child node.
vi.mock('@/components/sidebar/Sidebar', () => ({
  __esModule: true,
  default: () => <div data-testid="sidebar-mock" />,
}));

// Mock `react-router-dom` so we can drive a location change without a full
// `<MemoryRouter>` (we still use the existing `renderWithProviders` which sets
// one up, but we want a controllable useLocation return value for the
// auto-close test).
const locationState = { pathname: '/' };
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  );
  return {
    ...actual,
    useLocation: () => locationState,
  };
});

import { renderWithProviders } from '../../../utils/test-utils';
import HamburgerMenu from '../HamburgerMenu';

const setIsPhoneTiny = (value: boolean) => {
  mockLayout.mockReturnValue({
    isPhoneTiny: value,
    isMobile: value,
    isTablet: false,
    isDesktop: !value,
  });
};

describe('HamburgerMenu', () => {
  beforeEach(() => {
    mockLayout.mockReset();
    locationState.pathname = '/';
  });

  it('renders the hamburger IconButton when isPhoneTiny is true', () => {
    setIsPhoneTiny(true);
    renderWithProviders(<HamburgerMenu />);
    expect(screen.getByTestId('topbar-hamburger')).toBeInTheDocument();
  });

  it('renders null when isPhoneTiny is false', () => {
    setIsPhoneTiny(false);
    const { container } = renderWithProviders(<HamburgerMenu />);
    expect(container.querySelector('[data-testid="topbar-hamburger"]')).toBeNull();
  });

  it('opens the drawer when the hamburger button is tapped', async () => {
    setIsPhoneTiny(true);
    const user = userEvent.setup();
    renderWithProviders(<HamburgerMenu />);
    // SwipeableDrawer keeps its children mounted to enable swipe-to-open; we
    // assert the open state via aria-expanded on the trigger button instead.
    const btn = screen.getByTestId('topbar-hamburger');
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    await user.click(btn);
    await waitFor(() => {
      expect(btn).toHaveAttribute('aria-expanded', 'true');
    });
    // Sidebar mock is rendered inside the open drawer.
    expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
  });

  it('auto-closes ~80ms after a route change', async () => {
    setIsPhoneTiny(true);
    const user = userEvent.setup();
    const { rerender } = renderWithProviders(<HamburgerMenu />);

    await user.click(screen.getByTestId('topbar-hamburger'));
    expect(await screen.findByTestId('sidebar-mock')).toBeInTheDocument();
    expect(screen.getByTestId('topbar-hamburger')).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    // Mutate the mocked location and re-render so the effect re-runs with the
    // new dependency. After 80ms the timeout fires and the drawer closes.
    act(() => {
      locationState.pathname = '/dashboard';
    });
    rerender(<HamburgerMenu />);

    await waitFor(
      () => {
        expect(screen.getByTestId('topbar-hamburger')).toHaveAttribute(
          'aria-expanded',
          'false',
        );
      },
      { timeout: 500 },
    );
  });
});
