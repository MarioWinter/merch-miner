import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SnackbarProvider } from 'notistack';
import authReducer from '../../../../store/authSlice';
import LoginPage from '../LoginPage';
import '../../../../i18n';

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
  const store = configureStore({ reducer: { auth: authReducer } });
  render(
    <Provider store={store}>
      <MemoryRouter>
        <SnackbarProvider>
          <LoginPage />
        </SnackbarProvider>
      </MemoryRouter>
    </Provider>
  );
  return { store };
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
      user: { id: 1, email: 'test@example.com' },
    });

    const { store } = renderLoginPage();
    await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
    expect(store.getState().auth.isAuthenticated).toBe(true);
    expect(store.getState().auth.user).toEqual({ id: 1, email: 'test@example.com' });
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
