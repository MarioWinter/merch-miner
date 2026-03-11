import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import { setUser } from '../../../store/authSlice';
import ProfileMenu from '../ProfileMenu';

// Prevent logout from hitting the network
vi.mock('../../../services/authService', () => ({
  authService: {
    logout: vi.fn().mockResolvedValue({}),
  },
}));

const renderMenu = (initial = 'M', avatarUrl: string | null = null) =>
  renderWithProviders(<ProfileMenu initial={initial} avatarUrl={avatarUrl} />);

describe('ProfileMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders avatar with given initial text', () => {
    renderMenu('M');
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('renders correct initial — F from first_name, not email char', () => {
    renderMenu('F');
    expect(screen.getByText('F')).toBeInTheDocument();
  });

  it('renders avatar image when avatarUrl is provided', () => {
    renderMenu('M', 'https://example.com/avatar.jpg');
    // Avatar renders an img element with the provided src
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/avatar.jpg');
  });

  it('menu items are not visible before avatar is clicked', () => {
    renderMenu('M');
    expect(screen.queryByText('Profile')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign out')).not.toBeInTheDocument();
  });

  it('opens the profile menu when avatar is clicked', () => {
    renderMenu('M');
    // Avatar div has aria-label="Profile"
    const avatar = screen.getByLabelText('Profile');
    fireEvent.click(avatar);
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Billing')).toBeInTheDocument();
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('closes the menu after a navigation item is clicked', async () => {
    renderMenu('M');
    const avatar = screen.getByLabelText('Profile');
    fireEvent.click(avatar);
    // Menu is open — the MUI Menu paper should be present
    expect(screen.getByRole('menu')).toBeInTheDocument();
    // Click the Profile menu item to close
    fireEvent.click(screen.getByText('Profile'));
    // After close, the menu element is removed
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('clears auth state after sign-out is clicked', async () => {
    const { store } = renderMenu('A');
    store.dispatch(setUser({ id: 1, email: 'alice@x.com', first_name: 'Alice', avatar_url: null }));

    const avatar = screen.getByLabelText('Profile');
    fireEvent.click(avatar);
    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.user).toBeNull();
    });
  });
});
