import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { workspaceService } from '../../../../services/workspaceService';
import WorkspaceSection from '../WorkspaceSection';
import { renderWithProviders } from '../../../../utils/test-utils';

vi.mock('../../../../services/workspaceService', () => ({
  workspaceService: {
    getMyWorkspaces: vi.fn(),
    renameWorkspace: vi.fn(),
    inviteMember: vi.fn(),
    changeMemberRole: vi.fn(),
    removeMember: vi.fn(),
  },
}));

const mockGetMyWorkspaces = vi.mocked(workspaceService.getMyWorkspaces);
const mockInviteMember = vi.mocked(workspaceService.inviteMember);

const mockWorkspace = {
  id: 'ws-1',
  name: 'My Workspace',
  slug: 'my-workspace',
  role: 'admin' as const,
  members: [
    {
      id: 1,
      first_name: 'Alice',
      last_name: 'Smith',
      email: 'alice@example.com',
      username: 'alice',
      avatar_url: null,
      role: 'admin' as const,
      status: 'active' as const,
      is_owner: true,
    },
    {
      id: 2,
      first_name: 'Bob',
      last_name: 'Jones',
      email: 'bob@example.com',
      username: 'bob',
      avatar_url: null,
      role: 'member' as const,
      status: 'active' as const,
      is_owner: false,
    },
  ],
};

describe('WorkspaceSection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows skeleton while loading', () => {
    mockGetMyWorkspaces.mockImplementation(() => new Promise(() => {}));
    renderWithProviders(<WorkspaceSection />);
    expect(screen.queryByDisplayValue('My Workspace')).toBeNull();
  });

  it('renders workspace name and member table', async () => {
    mockGetMyWorkspaces.mockResolvedValueOnce([mockWorkspace]);
    renderWithProviders(<WorkspaceSection />);

    await waitFor(() =>
      expect(screen.getByDisplayValue('My Workspace')).toBeInTheDocument()
    );
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('hides remove button for owner', async () => {
    mockGetMyWorkspaces.mockResolvedValueOnce([mockWorkspace]);
    renderWithProviders(<WorkspaceSection />);

    await waitFor(() =>
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    );

    // Only one remove button (Bob, not Alice who is_owner)
    const removeButtons = screen.getAllByRole('button', {
      name: /remove member/i,
    });
    expect(removeButtons).toHaveLength(1);
  });

  it('calls inviteMember and shows success snackbar', async () => {
    mockGetMyWorkspaces.mockResolvedValueOnce([mockWorkspace]);
    mockInviteMember.mockResolvedValueOnce(undefined);
    renderWithProviders(<WorkspaceSection />);

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: /invite by email/i })).toBeInTheDocument()
    );

    await userEvent.type(
      screen.getByRole('textbox', { name: /invite by email/i }),
      'new@example.com'
    );
    await userEvent.click(
      screen.getByRole('button', { name: /send invite/i })
    );

    await waitFor(() =>
      expect(mockInviteMember).toHaveBeenCalledWith('ws-1', 'new@example.com')
    );
    await waitFor(() =>
      expect(screen.getByText(/invite sent/i)).toBeInTheDocument()
    );
  });

  it('shows empty state when no workspace returned', async () => {
    mockGetMyWorkspaces.mockResolvedValueOnce([]);
    renderWithProviders(<WorkspaceSection />);

    await waitFor(() =>
      expect(screen.getByText(/no workspace found/i)).toBeInTheDocument()
    );
  });
});
