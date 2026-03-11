import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import LoginPage from '../LoginPage';

vi.mock('../../../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    googleLoginUrl: vi.fn(() => '/api/auth/google/'),
  },
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
  beforeEach(() => vi.clearAllMocks());

  it('renders email/password form and Google button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('dispatches setUser and navigates on successful login', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.login).mockResolvedValueOnce({
      user: { id: 1, email: 'test@example.com', first_name: 'Test', avatar_url: null },
    });

    const { store } = renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.user).toEqual({ id: 1, email: 'test@example.com', first_name: 'Test', avatar_url: null });
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

  it('stores avatar_url in Redux when login returns one', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.login).mockResolvedValueOnce({
      user: { id: 2, email: 'alice@example.com', first_name: 'Alice', avatar_url: '/media/avatars/user_2/avatar.jpg' },
    });
    const { store } = renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(store.getState().auth.user?.avatar_url).toBe('/media/avatars/user_2/avatar.jpg');
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
});
