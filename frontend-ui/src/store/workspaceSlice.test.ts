import { describe, it, expect } from 'vitest';
import workspaceReducer, {
  setActiveWorkspace,
  fetchWorkspaces,
} from './workspaceSlice';
import { clearAuth } from './authSlice';
import type { Workspace } from '../services/workspaceService';

const makeWorkspace = (overrides?: Partial<Workspace>): Workspace => ({
  id: 'ws-1',
  name: 'Test Workspace',
  slug: 'test-workspace',
  role: 'admin',
  members: [],
  ...overrides,
});

describe('workspaceSlice', () => {
  it('initializes with empty state', () => {
    const state = workspaceReducer(undefined, { type: '@@INIT' });
    expect(state.workspaces).toEqual([]);
    expect(state.activeWorkspaceId).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setActiveWorkspace updates activeWorkspaceId', () => {
    const state = workspaceReducer(undefined, setActiveWorkspace('ws-99'));
    expect(state.activeWorkspaceId).toBe('ws-99');
  });

  it('fetchWorkspaces.fulfilled sets workspaces and picks first as active', () => {
    const workspaces = [makeWorkspace({ id: 'ws-a' }), makeWorkspace({ id: 'ws-b' })];
    const action = fetchWorkspaces.fulfilled(workspaces, '', undefined);
    const state = workspaceReducer(undefined, action);
    expect(state.workspaces).toEqual(workspaces);
    expect(state.activeWorkspaceId).toBe('ws-a');
  });

  it('fetchWorkspaces.fulfilled does not overwrite an already-active workspace', () => {
    const preloaded = workspaceReducer(undefined, setActiveWorkspace('ws-b'));
    const workspaces = [makeWorkspace({ id: 'ws-a' }), makeWorkspace({ id: 'ws-b' })];
    const action = fetchWorkspaces.fulfilled(workspaces, '', undefined);
    const state = workspaceReducer(preloaded, action);
    expect(state.activeWorkspaceId).toBe('ws-b');
  });

  it('clearAuth resets workspace state to initial values', () => {
    // Simulate a logged-in state with workspaces loaded
    const loaded = workspaceReducer(
      undefined,
      fetchWorkspaces.fulfilled([makeWorkspace()], '', undefined)
    );
    expect(loaded.workspaces.length).toBe(1);
    expect(loaded.activeWorkspaceId).toBe('ws-1');

    // Dispatch clearAuth (the logout action from authSlice)
    const reset = workspaceReducer(loaded, clearAuth());
    expect(reset.workspaces).toEqual([]);
    expect(reset.activeWorkspaceId).toBeNull();
    expect(reset.loading).toBe(false);
    expect(reset.error).toBeNull();
  });

  it('clearAuth clears a manually-set activeWorkspaceId', () => {
    const withActive = workspaceReducer(undefined, setActiveWorkspace('ws-stale'));
    const reset = workspaceReducer(withActive, clearAuth());
    expect(reset.activeWorkspaceId).toBeNull();
  });
});
