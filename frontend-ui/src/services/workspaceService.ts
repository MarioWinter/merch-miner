import { apiClient } from './authService';

export type MemberRole = 'admin' | 'member';
export type MemberStatus = 'pending' | 'active';

export interface WorkspaceMember {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
  avatar_url: string | null;
  role: MemberRole;
  status: MemberStatus;
  is_owner: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  members: WorkspaceMember[];
}

export const workspaceService = {
  async getMyWorkspaces(): Promise<Workspace[]> {
    const { data } = await apiClient.get('/api/workspaces/me/');
    type RawUser = { id: number; first_name: string; last_name: string; email: string; username: string; avatar_url: string | null };
    type RawMember = { user: RawUser; role: MemberRole; status: MemberStatus; is_owner: boolean };
    type RawWorkspace = { id: string; name: string; slug: string; role: MemberRole; owner?: { id: number }; members?: RawMember[] };
    return data.map((ws: RawWorkspace) => ({
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      role: ws.role,
      members: (ws.members ?? []).map((m: RawMember) => ({
        id: m.user.id,
        first_name: m.user.first_name || '',
        last_name: m.user.last_name || '',
        email: m.user.email || '',
        username: m.user.username || m.user.email || '',
        avatar_url: m.user.avatar_url || null,
        role: m.role,
        status: m.status,
        is_owner: m.user.id === ws.owner?.id,
      })),
    }));
  },

  async renameWorkspace(id: string, name: string): Promise<Workspace> {
    const { data } = await apiClient.patch(`/api/workspaces/${id}/`, { name });
    return data;
  },

  async inviteMember(id: string, email: string): Promise<void> {
    await apiClient.post(`/api/workspaces/${id}/invite/`, { email });
  },

  async changeMemberRole(
    workspaceId: string,
    userId: number,
    role: MemberRole
  ): Promise<void> {
    await apiClient.patch(
      `/api/workspaces/${workspaceId}/members/${userId}/`,
      { role }
    );
  },

  async removeMember(workspaceId: string, userId: number): Promise<void> {
    await apiClient.delete(
      `/api/workspaces/${workspaceId}/members/${userId}/`
    );
  },

  async acceptInvite(token: string): Promise<{
    workspace_name?: string;
    already_accepted?: boolean;
    needs_password_setup?: boolean;
    password_reset_uid?: string;
    password_reset_token?: string;
  }> {
    const { data } = await apiClient.get('/api/workspaces/invite/accept/', {
      params: { token },
    });
    return data;
  },
};
