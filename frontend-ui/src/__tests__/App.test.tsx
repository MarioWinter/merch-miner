import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../utils/test-utils';

// Hoisted mock — must be set BEFORE the App module is imported because
// `isRegistrationEnabled` is called at App component-construction time.
const isRegistrationEnabledMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('../utils/isRegistrationEnabled', () => ({
  isRegistrationEnabled: isRegistrationEnabledMock,
}));

// Stub heavy views so the test runner doesn't transitively load every service.
// We only need router behavior — actual view content is irrelevant here.
vi.mock('../services/authService', () => ({
  hydrateAuth: vi.fn().mockResolvedValue(undefined),
  authService: {
    login: vi.fn(),
    googleLoginUrl: vi.fn(() => '/api/auth/google/'),
  },
}));

vi.mock('../components/PrivateRoute', () => ({
  default: () => <div data-testid="private-route" />,
}));

vi.mock('../views/auth/login/LoginPage', () => ({
  default: () => <div data-testid="login-page">LoginPage</div>,
}));

vi.mock('../views/auth/register/RegisterPage', () => ({
  default: () => <div data-testid="register-page">RegisterPage</div>,
}));

vi.mock('../views/auth/activate/ActivatePage', () => ({
  default: () => <div data-testid="activate-page" />,
}));

vi.mock('../views/auth/password-reset/PasswordResetPage', () => ({
  default: () => <div data-testid="password-reset-page" />,
}));

vi.mock('../views/auth/password-reset/PasswordConfirmPage', () => ({
  default: () => <div data-testid="password-confirm-page" />,
}));

vi.mock('../views/invite/InviteAcceptView', () => ({
  default: () => <div data-testid="invite-accept" />,
}));

vi.mock('../views/legal/imprint/ImprintPage', () => ({
  default: () => <div data-testid="imprint-page" />,
}));

vi.mock('../views/legal/privacy/PrivacyPage', () => ({
  default: () => <div data-testid="privacy-page" />,
}));

vi.mock('../views/shared/SharedChatView', () => ({
  default: () => <div data-testid="shared-chat" />,
}));

// Protected views — never reached in these tests because PrivateRoute is stubbed,
// but the imports must resolve.
vi.mock('../components/AppLayout', () => ({
  default: () => <div data-testid="app-layout" />,
}));
vi.mock('../views/niches/list/NicheListView', () => ({ default: () => null }));
vi.mock('../views/niches/research', () => ({ default: () => null }));
vi.mock('../views/amazon/research/AmazonResearchView', () => ({ default: () => null }));
vi.mock('../views/ideas/IdeaListView', () => ({ default: () => null }));
vi.mock('../views/designs/gallery/ProjectGalleryView', () => ({ default: () => null }));
vi.mock('../views/designs/workspace/DesignWorkspaceView', () => ({ default: () => null }));
vi.mock('../views/amazon/keywords/research/KeywordResearchView', () => ({ default: () => null }));
vi.mock('../views/publish/PublishView', () => ({ default: () => null }));
vi.mock('../views/publish/EditView', () => ({ default: () => null }));
vi.mock('../views/dashboard/DashboardView', () => ({ default: () => null }));
vi.mock('../views/kanban/KanbanBoardView', () => ({ default: () => null }));
vi.mock('../views/amazon/research/detail/ProductDetailPage', () => ({ default: () => null }));
vi.mock('../views/settings/SettingsLayout', () => ({ default: () => null }));

describe('App routing — REGISTRATION_ENABLED feature flag (PROJ-24 AC-22)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('mounts /register route when REGISTRATION_ENABLED flag is on', async () => {
    isRegistrationEnabledMock.mockReturnValue(true);
    const { default: App } = await import('../App');

    renderWithProviders(<App />, { initialRoute: '/register' });

    expect(screen.getByTestId('register-page')).toBeInTheDocument();
  });

  it('does NOT mount /register route when REGISTRATION_ENABLED flag is off — falls through to fallback', async () => {
    isRegistrationEnabledMock.mockReturnValue(false);
    const { default: App } = await import('../App');

    renderWithProviders(<App />, { initialRoute: '/register' });

    // Register page must NOT render
    expect(screen.queryByTestId('register-page')).not.toBeInTheDocument();
    // The `*` fallback redirects to /dashboard which is inside <PrivateRoute /> (stubbed).
    // We assert the PrivateRoute stub renders, proving fallback fired.
    expect(screen.getByTestId('private-route')).toBeInTheDocument();
  });

  it('renders LoginPage at /login regardless of flag state', async () => {
    isRegistrationEnabledMock.mockReturnValue(false);
    const { default: App } = await import('../App');

    renderWithProviders(<App />, { initialRoute: '/login' });

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });
});
