import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, screen } from '@testing-library/react';

// PROJ-30 T2.6 — mock useResponsiveLayout so each test can drive a viewport
// tier without depending on JSDOM matchMedia. Defaults to desktop.
const mockLayout = vi.fn();
vi.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => mockLayout(),
}));

import { renderWithProviders } from '../../../utils/test-utils';
import { setUser } from '../../../store/authSlice';
import chatBarReducer from '../../../store/chatBarSlice';
import Topbar from '../Topbar';

// MobileContextChip reads chatBar.activeNicheId — register the slice so the
// mobile + phone-tiny tests don't crash on selector access.
const renderTopbar = () =>
  renderWithProviders(<Topbar />, { reducers: { chatBar: chatBarReducer } });

// WorkspaceSelector fetches workspaces — stub it out so Topbar tests stay focused
vi.mock('../WorkspaceSelector', () => ({
  default: () => <div data-testid="workspace-selector" />,
}));

// NicheSelector reads chatBar.activeNicheId + niches RTK Query — stub it out.
vi.mock('../NicheSelector', () => ({
  default: () => <div data-testid="niche-selector" />,
}));

// MobileContextSheet — stub its inner pickers; expose chip via real chip from
// `MobileContextControl`. The chip itself queries niches via RTK Query; mock
// useListNichesQuery so it returns empty without spinning up the reducer.
vi.mock('@/store/nicheSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/nicheSlice')>();
  return {
    ...actual,
    useListNichesQuery: () => ({ data: { results: [] }, isFetching: false }),
  };
});

// NotificationBell uses notificationApi (RTK Query) — stub to avoid store middleware error
vi.mock('../../NotificationBell', () => ({
  default: () => null,
}));

// HealthStatusDot uses searchApi (RTK Query) — stub to avoid store middleware error
vi.mock('../../MultiPurposeDrawer/HealthStatusDot', () => ({
  default: () => null,
}));

const setLayout = (overrides: Partial<{
  isPhoneTiny: boolean;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}>) => {
  // Default to "all-false" so callers explicitly opt-in to the tier they need.
  // Real useResponsiveLayout returns exactly ONE tier flag true (sm/md/lg are
  // mutually exclusive), so test overrides must too.
  mockLayout.mockReturnValue({
    isPhoneTiny: false,
    isMobile: false,
    isTablet: false,
    isDesktop: false,
    ...overrides,
  });
};

beforeEach(() => {
  mockLayout.mockReset();
  // Default to desktop unless a test overrides
  setLayout({ isDesktop: true });
});

describe('Topbar — avatar initial derivation', () => {
  it('shows first_name initial (M) when first_name is set, not email initial (b)', async () => {
    const { store } = renderTopbar();
    await act(async () => {
      store.dispatch(setUser({ id: 1, email: 'bob@example.com', first_name: 'Mario', avatar_url: null, is_staff: false, is_superuser: false }));
    });
    // 'M' from first_name should appear; 'B' from email should not be the initial
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('falls back to email initial when first_name is empty string', async () => {
    const { store } = renderTopbar();
    await act(async () => {
      store.dispatch(setUser({ id: 2, email: 'zoe@example.com', first_name: '', avatar_url: null, is_staff: false, is_superuser: false }));
    });
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('shows ? when no user is authenticated', () => {
    renderTopbar();
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('shows app name in topbar', () => {
    renderTopbar();
    expect(screen.getByText('MerchMiner')).toBeInTheDocument();
  });

  it('renders avatar img when avatar_url is set on user', async () => {
    const { store } = renderTopbar();
    await act(async () => {
      store.dispatch(setUser({ id: 3, email: 'alice@x.com', first_name: 'Alice', avatar_url: '/media/avatars/user_3/avatar.jpg', is_staff: false, is_superuser: false }));
    });
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/media/avatars/user_3/avatar.jpg');
  });
});

/**
 * Unit-level tests for the initial derivation logic — these are pure
 * JS computations that mirror exactly what Topbar.tsx does, so they
 * remain stable if we rename sub-components.
 */
describe('avatar initial derivation logic', () => {
  const deriveInitial = (firstName: string, email: string) =>
    firstName.charAt(0).toUpperCase() ||
    email.charAt(0).toUpperCase() ||
    '?';

  it('prefers first_name over email', () => {
    expect(deriveInitial('Alice', 'bob@example.com')).toBe('A');
  });

  it('falls back to email when first_name is empty', () => {
    expect(deriveInitial('', 'charlie@example.com')).toBe('C');
  });

  it('returns ? when both are empty', () => {
    expect(deriveInitial('', '')).toBe('?');
  });

  it('returns uppercase initial', () => {
    expect(deriveInitial('david', 'x@x.com')).toBe('D');
  });

  it('email fallback is also uppercased', () => {
    expect(deriveInitial('', 'eve@x.com')).toBe('E');
  });
});

/**
 * PROJ-30 T2.4 + T2.6 — responsive Topbar collapse logic.
 */
describe('Topbar — responsive context chip collapse', () => {
  it('renders both desktop chips when isDesktop is true', () => {
    setLayout({ isDesktop: true });
    renderTopbar();
    expect(screen.getByTestId('workspace-selector')).toBeInTheDocument();
    expect(screen.getByTestId('niche-selector')).toBeInTheDocument();
    expect(
      screen.queryByTestId('topbar-mobile-context-chip'),
    ).not.toBeInTheDocument();
  });

  it('renders the mobile context chip on isMobile', () => {
    setLayout({ isMobile: true });
    renderTopbar();
    expect(screen.getByTestId('topbar-mobile-context-chip')).toBeInTheDocument();
    // Topbar tablet/desktop chip-pair containers must be absent — the chip
    // mocks are reused inside the MobileContextSheet so testing absence-by-
    // testid is too aggressive; we assert on the container test-ids instead.
    expect(screen.queryByTestId('topbar-chip-pair-tablet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('topbar-chip-pair-desktop')).not.toBeInTheDocument();
  });

  it('renders the chip pair (no MobileContextChip) on isTablet', () => {
    setLayout({ isTablet: true });
    renderTopbar();
    expect(screen.getByTestId('workspace-selector')).toBeInTheDocument();
    expect(screen.getByTestId('niche-selector')).toBeInTheDocument();
    expect(
      screen.queryByTestId('topbar-mobile-context-chip'),
    ).not.toBeInTheDocument();
  });

  it('renders the Hamburger button when isPhoneTiny is true', () => {
    setLayout({ isPhoneTiny: true, isMobile: true });
    renderTopbar();
    expect(screen.getByTestId('topbar-hamburger')).toBeInTheDocument();
    // Mobile context chip still rendered (isMobile = true).
    expect(screen.getByTestId('topbar-mobile-context-chip')).toBeInTheDocument();
  });

  it('does NOT render the Hamburger button on isDesktop', () => {
    setLayout({ isDesktop: true });
    renderTopbar();
    expect(screen.queryByTestId('topbar-hamburger')).not.toBeInTheDocument();
  });
});
