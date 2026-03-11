import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { CssVarsProvider } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import authReducer from '../../../../store/authSlice';
import workspaceReducer from '../../../../store/workspaceSlice';
import theme from '../../../../style/theme';
import { renderWithProviders } from '../../../../utils/test-utils';
import PasswordConfirmPage from '../PasswordConfirmPage';

vi.mock('../../../../services/authService', () => ({
  authService: {
    confirmPasswordReset: vi.fn(),
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

/** Renders PasswordConfirmPage without location state (no uid/token). */
const renderWithoutState = () => renderWithProviders(<PasswordConfirmPage />);

/** Renders PasswordConfirmPage with location.state carrying uid and token. */
const renderWithState = (state: { uid?: string; token?: string }) => {
  const store = configureStore({ reducer: { auth: authReducer, workspace: workspaceReducer } });

  return render(
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider maxSnack={4} autoHideDuration={4000}>
          <MemoryRouter initialEntries={[{ pathname: '/password-reset/confirm', state }]}>
            <PasswordConfirmPage />
          </MemoryRouter>
        </SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );
};

describe('PasswordConfirmPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders new password and confirm password fields', () => {
    renderWithoutState();
    // Both fields share "new password" text — use exact label matches
    expect(screen.getByLabelText('New password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm new password')).toBeInTheDocument();
  });

  it('disables submit button when no uid/token in location state', () => {
    renderWithoutState();
    expect(screen.getByRole('button', { name: /set new password/i })).toBeDisabled();
  });

  it('enables submit button when uid and token are in location state', () => {
    renderWithState({ uid: 'test-uid', token: 'test-token' });
    expect(screen.getByRole('button', { name: /set new password/i })).not.toBeDisabled();
  });

  it('calls confirmPasswordReset with uid and token from location state on submit', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.confirmPasswordReset).mockResolvedValueOnce(undefined);

    renderWithState({ uid: 'abc123', token: 'tok456' });

    await userEvent.type(screen.getByLabelText('New password'), 'NewPass123!');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass123!');
    await userEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() =>
      expect(authService.confirmPasswordReset).toHaveBeenCalledWith({
        uid: 'abc123',
        token: 'tok456',
        new_password: 'NewPass123!',
        confirm_password: 'NewPass123!',
      })
    );
  });

  it('navigates to /login on successful password reset', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.confirmPasswordReset).mockResolvedValueOnce(undefined);

    renderWithState({ uid: 'abc123', token: 'tok456' });

    await userEvent.type(screen.getByLabelText('New password'), 'NewPass123!');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass123!');
    await userEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
    );
  });

  it('shows error snackbar when confirmPasswordReset fails', async () => {
    const { authService } = await import('../../../../services/authService');
    vi.mocked(authService.confirmPasswordReset).mockRejectedValueOnce(new Error('Link expired'));

    renderWithState({ uid: 'bad-uid', token: 'bad-token' });

    await userEvent.type(screen.getByLabelText('New password'), 'NewPass123!');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPass123!');
    await userEvent.click(screen.getByRole('button', { name: /set new password/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to set password/i)).toBeInTheDocument()
    );
  });
});
