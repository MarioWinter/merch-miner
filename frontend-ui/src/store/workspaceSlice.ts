import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import {
  workspaceService,
  type Workspace,
  type MemberRole,
} from '../services/workspaceService';
import { clearAuth } from './authSlice';

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loading: boolean;
  error: string | null;
}

const ACTIVE_WORKSPACE_STORAGE_KEY = 'mm.activeWorkspaceId';

const readPersistedWorkspaceId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
};

const persistWorkspaceId = (id: string | null) => {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_WORKSPACE_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    /* quota / access denied — safe to ignore */
  }
};

const initialState: WorkspaceState = {
  workspaces: [],
  activeWorkspaceId: readPersistedWorkspaceId(),
  loading: false,
  error: null,
};

export const fetchWorkspaces = createAsyncThunk(
  'workspace/fetchWorkspaces',
  async (_, { rejectWithValue }) => {
    try {
      return await workspaceService.getMyWorkspaces();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to load workspaces';
      return rejectWithValue(msg);
    }
  }
);

export const renameWorkspace = createAsyncThunk(
  'workspace/rename',
  async (
    { id, name }: { id: string; name: string },
    { rejectWithValue }
  ) => {
    try {
      return await workspaceService.renameWorkspace(id, name);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to rename workspace';
      return rejectWithValue(msg);
    }
  }
);

export const changeMemberRole = createAsyncThunk(
  'workspace/changeMemberRole',
  async (
    {
      workspaceId,
      userId,
      role,
    }: { workspaceId: string; userId: number; role: MemberRole },
    { rejectWithValue }
  ) => {
    try {
      await workspaceService.changeMemberRole(workspaceId, userId, role);
      return { workspaceId, userId, role };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update role';
      return rejectWithValue(msg);
    }
  }
);

export const removeMember = createAsyncThunk(
  'workspace/removeMember',
  async (
    { workspaceId, userId }: { workspaceId: string; userId: number },
    { rejectWithValue }
  ) => {
    try {
      await workspaceService.removeMember(workspaceId, userId);
      return { workspaceId, userId };
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to remove member';
      return rejectWithValue(msg);
    }
  }
);

const workspaceSlice = createSlice({
  name: 'workspace',
  initialState,
  reducers: {
    setActiveWorkspace(state, action: PayloadAction<string>) {
      state.activeWorkspaceId = action.payload;
      persistWorkspaceId(action.payload);
    },
    updateMemberAvatar(
      state,
      action: PayloadAction<{ userId: number; avatar_url: string }>
    ) {
      const { userId, avatar_url } = action.payload;
      state.workspaces.forEach((ws) => {
        const member = ws.members.find((m) => m.id === userId);
        if (member) member.avatar_url = avatar_url;
      });
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchWorkspaces
      .addCase(fetchWorkspaces.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchWorkspaces.fulfilled, (state, action) => {
        state.loading = false;
        state.workspaces = action.payload;
        // Prefer a persisted id only if the user is still a member of that
        // workspace — otherwise fall back to the first workspace in the
        // response (and clear stale localStorage).
        const persistedStillValid =
          state.activeWorkspaceId !== null &&
          action.payload.some((w) => w.id === state.activeWorkspaceId);
        if (!persistedStillValid && action.payload.length > 0) {
          state.activeWorkspaceId = action.payload[0].id;
          persistWorkspaceId(action.payload[0].id);
        } else if (action.payload.length === 0) {
          state.activeWorkspaceId = null;
          persistWorkspaceId(null);
        }
      })
      .addCase(fetchWorkspaces.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // renameWorkspace
      .addCase(renameWorkspace.fulfilled, (state, action) => {
        const { id, name } = action.meta.arg;
        const idx = state.workspaces.findIndex((w) => w.id === id);
        if (idx !== -1) state.workspaces[idx].name = name;
      })
      // changeMemberRole
      .addCase(changeMemberRole.fulfilled, (state, action) => {
        const ws = state.workspaces.find(
          (w) => w.id === action.payload.workspaceId
        );
        if (ws) {
          const member = ws.members.find(
            (m) => m.id === action.payload.userId
          );
          if (member) member.role = action.payload.role;
        }
      })
      // removeMember
      .addCase(removeMember.fulfilled, (state, action) => {
        const ws = state.workspaces.find(
          (w) => w.id === action.payload.workspaceId
        );
        if (ws) {
          ws.members = ws.members.filter(
            (m) => m.id !== action.payload.userId
          );
        }
      })
      // Reset workspace state when the user logs out.
      // Also clear persisted id — otherwise the next user on the shared
      // machine inherits the previous user's workspace pointer.
      .addCase(clearAuth, () => {
        persistWorkspaceId(null);
        return { ...initialState, activeWorkspaceId: null };
      });
  },
});

export const { setActiveWorkspace, updateMemberAvatar } = workspaceSlice.actions;
export default workspaceSlice.reducer;
