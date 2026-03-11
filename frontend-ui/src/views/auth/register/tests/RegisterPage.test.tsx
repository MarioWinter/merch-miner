import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import RegisterPage from '../RegisterPage';

vi.mock('../../../../services/authService', () => ({
  authService: {
    register: vi.fn(),
    googleLoginUrl: vi.fn(() => '/api/auth/google/'),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderRegisterPage() {
  return renderWithProviders(<RegisterPage />);
}

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders registration form and Google button', () => {
    renderRegisterPage();
    expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('navigates to /login on successful registration', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.register).mockResolvedValueOnce({ user: { id: 2, email: 'new@example.com' } });

    renderRegisterPage();
    await userEvent.type(screen.getByLabelText(/^email/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true }));
  });

  it('shows error snackbar and dispatches setError on failed registration', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.register).mockRejectedValueOnce(new Error('Bad Request'));

    const { store } = renderRegisterPage();
    await userEvent.type(screen.getByLabelText(/^email/i), 'fail@example.com');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'Password123!');
    await userEvent.type(screen.getByLabelText(/confirm password/i), 'Password123!');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument()
    );
    expect(store.getState().auth.error).toBe('Registration failed. Please try again.');
  });
});
