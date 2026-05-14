import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../utils/test-utils';
import { setUser } from '../../../store/authSlice';
import chatBarReducer, {
  setActiveSession,
  setInputChip,
} from '../../../store/chatBarSlice';
import attachmentsReducer from '../../../store/attachmentsSlice';
import ProfileMenu from '../ProfileMenu';

// Prevent logout from hitting the network
vi.mock('../../../services/authService', () => ({
  authService: {
    logout: vi.fn().mockResolvedValue({}),
  },
}));

const renderMenu = (initial = 'M', avatarUrl: string | null = null) =>
  renderWithProviders(<ProfileMenu initial={initial} avatarUrl={avatarUrl} />, {
    reducers: { chatBar: chatBarReducer, attachments: attachmentsReducer },
  });

describe('ProfileMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof localStorage !== 'undefined') localStorage.clear();
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
    store.dispatch(setUser({ id: 1, email: 'alice@x.com', first_name: 'Alice', avatar_url: null, is_staff: false, is_superuser: false }));

    const avatar = screen.getByLabelText('Profile');
    fireEvent.click(avatar);
    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().auth.user).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // PROJ-29 Phase 1F — localStorage cleanup + Redux reset on logout
  // ----------------------------------------------------------------
  it('removes every mm-active-chat-* localStorage key on sign-out', async () => {
    // Pre-populate two workspace-scoped pointers and a third unrelated key.
    localStorage.setItem('mm-active-chat-session-ws-1', 'sess-A-1');
    localStorage.setItem('mm-active-chat-session-ws-2', 'sess-A-2');
    localStorage.setItem('unrelated-key', 'keep-me');

    renderMenu('A');
    fireEvent.click(screen.getByLabelText('Profile'));
    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(localStorage.getItem('mm-active-chat-session-ws-1')).toBeNull();
      expect(localStorage.getItem('mm-active-chat-session-ws-2')).toBeNull();
    });
    // Unrelated keys must remain untouched.
    expect(localStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('resets chat-bar Redux state on sign-out', async () => {
    const { store } = renderMenu('A');
    // Simulate an in-progress chat with niche chip + active session id.
    store.dispatch(setActiveSession('sess-A-1'));
    store.dispatch(setInputChip({ niche_id: 'niche-1', niche_name: 'Cats' }));
    expect(store.getState().chatBar.activeSessionId).toBe('sess-A-1');
    expect(store.getState().chatBar.inputChip).not.toBeNull();

    fireEvent.click(screen.getByLabelText('Profile'));
    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(store.getState().chatBar.activeSessionId).toBeNull();
      expect(store.getState().chatBar.inputChip).toBeNull();
    });
  });

  it('does not leak previous user state when a second user signs in on the same browser', async () => {
    // ----- User A session -----
    const { store, unmount } = renderMenu('A');
    store.dispatch(setUser({ id: 1, email: 'alice@x.com', first_name: 'Alice', avatar_url: null, is_staff: false, is_superuser: false }));
    store.dispatch(setActiveSession('sess-A-1'));
    store.dispatch(setInputChip({ niche_id: 'niche-A', niche_name: 'A-Niche' }));
    localStorage.setItem('mm-active-chat-session-ws-A', 'sess-A-1');

    // Sign out user A — exercises every cleanup step.
    fireEvent.click(screen.getByLabelText('Profile'));
    fireEvent.click(screen.getByText('Sign out'));

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false);
      expect(store.getState().chatBar.activeSessionId).toBeNull();
      expect(localStorage.getItem('mm-active-chat-session-ws-A')).toBeNull();
    });
    unmount();

    // ----- User B signs in fresh -----
    const second = renderMenu('B');
    second.store.dispatch(setUser({ id: 2, email: 'bob@x.com', first_name: 'Bob', avatar_url: null, is_staff: false, is_superuser: false }));

    // B's store must NOT contain A's session id, A's niche chip, or A's
    // localStorage pointer. This is the cross-user isolation guarantee.
    expect(second.store.getState().chatBar.activeSessionId).toBeNull();
    expect(second.store.getState().chatBar.inputChip).toBeNull();
    expect(localStorage.getItem('mm-active-chat-session-ws-A')).toBeNull();
    expect(second.store.getState().auth.user?.email).toBe('bob@x.com');
  });
});
