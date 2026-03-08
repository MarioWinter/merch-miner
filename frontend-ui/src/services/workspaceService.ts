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
    return data;
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
};
