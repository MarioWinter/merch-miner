import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import LoginPage from '../LoginPage';
import { isRegistrationEnabled } from '../../../../utils/isRegistrationEnabled';
import { isGoogleLoginEnabled } from '../../../../utils/isGoogleLoginEnabled';

vi.mock('../../../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    getMe: vi.fn(),
    googleLoginUrl: vi.fn(() => '/api/auth/google/'),
  },
  // hydrateAuth pulls /me/ and dispatches setUser — drive it via getMe mock.
  hydrateAuth: vi.fn(),
}));

vi.mock('../../../../utils/isRegistrationEnabled', () => ({
  isRegistrationEnabled: vi.fn(() => true),
}));

vi.mock('../../../../utils/isGoogleLoginEnabled', () => ({
  isGoogleLoginEnabled: vi.fn(() => true),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLoginPage() {
  return renderWithProviders(<LoginPage />);
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: registration enabled (existing tests rely on link being present-or-irrelevant)
    vi.mocked(isRegistrationEnabled).mockReturnValue(true);
    vi.mocked(isGoogleLoginEnabled).mockReturnValue(true);
  });

  it('renders email/password form and Google button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('calls hydrateAuth and navigates on successful login', async () => {
    const { authService, hydrateAuth } = await import('../../../../services/authService');
    vi.mocked(authService.login).mockResolvedValueOnce({ detail: 'Login successful' });
    vi.mocked(hydrateAuth).mockResolvedValueOnce(undefined);

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    // hydrateAuth (not raw login response) is the source of truth for the
    // Redux user — guarantees fresh features list on user-switch.
    expect(hydrateAuth).toHaveBeenCalledTimes(1);
  });

  it('shows error snackbar and dispatches setError on failed login', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.login).mockRejectedValueOnce(new Error('Unauthorized'));

    const { store } = renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'bad@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
    expect(store.getState().auth.isAuthenticated).toBe(false);
    expect(store.getState().auth.error).toBe('Invalid email or password');
  });

  it('triggers hydrateAuth even for users with avatar_url (covered by hydrateAuth/me/ payload)', async () => {
    const { authService, hydrateAuth } = await import('../../../../services/authService');
    vi.mocked(authService.login).mockResolvedValueOnce({ detail: 'Login successful' });
    vi.mocked(hydrateAuth).mockResolvedValueOnce(undefined);

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    // Avatar URL handling lives in hydrateAuth (covered by its own tests);
    // here we just verify the flow delegates to hydrateAuth.
    expect(hydrateAuth).toHaveBeenCalledTimes(1);
  });

  it('shows loading spinner while login is in progress', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.login).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  // PROJ-24 AC-21 — register link gating via REGISTRATION_ENABLED feature flag
  it('hides register link when REGISTRATION_ENABLED flag is off', () => {
    vi.mocked(isRegistrationEnabled).mockReturnValue(false);
    renderLoginPage();

    expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have an account/i)).not.toBeInTheDocument();
  });

  it('shows register link when REGISTRATION_ENABLED flag is on', () => {
    vi.mocked(isRegistrationEnabled).mockReturnValue(true);
    renderLoginPage();

    const signUpLink = screen.getByRole('link', { name: /sign up/i });
    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute('href', '/register');
  });
});
