import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UpscaleCloudTarget, UpscaleDestination } from './upscaleApi';

// -----------------------------------------------------------------
// Local-storage keys (per-workspace where applicable)
// -----------------------------------------------------------------

const LS_ACTIVE_BATCH = 'mm-upscale-active-batch';
const LS_DESTINATION_PREFIX = 'mm-upscale-destination:';
const LS_CLOUD_TARGET_PREFIX = 'mm-upscale-cloud-target:';

// Storage may be unavailable (SSR / privacy mode). Soft-fail in those cases.
const safeGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore quota / privacy errors
  }
};

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

// -----------------------------------------------------------------
// State
// -----------------------------------------------------------------

/**
 * Phase 10 — last terminal-state event of a single upscale.
 * Used by the workspace-level snackbar effect to fire exactly one snackbar
 * per completion, with the wording switched based on which tab the user is
 * currently on (same-tab vs cross-tab variant).
 */
export interface UpscaleCompletion {
  designId: string | null;
  /**
   * Phase B (FIX-canvas-editor-bugs-and-image-gen) — the project the design
   * belongs to. Plumbed through so the global completion snackbar can render
   * an "Open in Canvas" action that navigates to `/designs/<projectId>`.
   * Null when the dispatch site has no project context (defensive).
   */
  projectId: string | null;
  kind: 'success' | 'error';
  /** Optional sub-error code for finer-grained snackbar wording (timeout, etc.). */
  reason?: 'timeout' | 'trigger_failed' | 'quota_exceeded';
  ts: number;
}

export interface UpscaleSliceState {
  /** Currently-tracked batch id (for the topbar pill + drawer rehydrate). */
  activeBatchId: string | null;
  /** Whether the bulk drawer is open (re-openable from the topbar pill). */
  drawerOpen: boolean;
  /** Per-workspace last-used destination preference. */
  destinationByWorkspace: Record<string, UpscaleDestination>;
  /** Per-workspace last-used cloud target. */
  cloudTargetByWorkspace: Record<string, UpscaleCloudTarget | null>;
  /** Local-only filter — hides completed rows in the drawer (does not delete). */
  hideCompletedInDrawer: boolean;
  /**
   * Phase 9 — workspace-level set of designIds currently being upscaled.
   * Stored as array (Redux Toolkit avoids non-serializable Set in state).
   * Powers the shimmer overlay on the canvas while either the standalone
   * Upscale tool OR the Apply-Pipeline upscale step is running.
   */
  processingDesignIds: string[];
  /**
   * Phase 10 — last terminal-state completion event. Workspace effect
   * watches this and fires either the same-tab or the cross-tab snackbar
   * exactly once per change. Hook never enqueues snackbars itself.
   */
  lastCompletion: UpscaleCompletion | null;
}

const initialState: UpscaleSliceState = {
  activeBatchId: safeGet(LS_ACTIVE_BATCH),
  drawerOpen: false,
  destinationByWorkspace: {},
  cloudTargetByWorkspace: {},
  hideCompletedInDrawer: false,
  processingDesignIds: [],
  lastCompletion: null,
};

// -----------------------------------------------------------------
// Slice
// -----------------------------------------------------------------

const upscaleSlice = createSlice({
  name: 'upscale',
  initialState,
  reducers: {
    setActiveBatch(state, action: PayloadAction<string | null>) {
      state.activeBatchId = action.payload;
      if (action.payload) {
        safeSet(LS_ACTIVE_BATCH, action.payload);
      } else {
        safeRemove(LS_ACTIVE_BATCH);
      }
    },
    openDrawer(state) {
      state.drawerOpen = true;
    },
    closeDrawer(state) {
      state.drawerOpen = false;
    },
    toggleHideCompleted(state) {
      state.hideCompletedInDrawer = !state.hideCompletedInDrawer;
    },
    setDestination(
      state,
      action: PayloadAction<{ workspaceId: string; destination: UpscaleDestination }>,
    ) {
      const { workspaceId, destination } = action.payload;
      state.destinationByWorkspace[workspaceId] = destination;
      safeSet(LS_DESTINATION_PREFIX + workspaceId, destination);
    },
    setCloudTarget(
      state,
      action: PayloadAction<{ workspaceId: string; target: UpscaleCloudTarget | null }>,
    ) {
      const { workspaceId, target } = action.payload;
      state.cloudTargetByWorkspace[workspaceId] = target;
      const lsKey = LS_CLOUD_TARGET_PREFIX + workspaceId;
      if (target) {
        safeSet(lsKey, JSON.stringify(target));
      } else {
        safeRemove(lsKey);
      }
    },
    /**
     * One-time hydration on app mount: pulls per-workspace prefs from
     * localStorage. Called from a thunk in the App shell, after auth
     * resolves (so we know which workspaces this user has).
     */
    addProcessingDesignId(state, action: PayloadAction<string>) {
      const designId = action.payload;
      if (!state.processingDesignIds.includes(designId)) {
        state.processingDesignIds.push(designId);
      }
    },
    removeProcessingDesignId(state, action: PayloadAction<string>) {
      state.processingDesignIds = state.processingDesignIds.filter(
        (id) => id !== action.payload,
      );
    },
    /**
     * Phase 10 — record a terminal-state completion. Workspace effect
     * reacts to ts changes and fires the appropriate snackbar exactly once.
     */
    recordCompletion(state, action: PayloadAction<UpscaleCompletion>) {
      state.lastCompletion = action.payload;
      // Defensive: any terminal-state completion also clears the matching
      // designId from `processingDesignIds`, so the shimmer overlay stops
      // even if the hook that started the upscale already unmounted.
      if (action.payload.designId) {
        state.processingDesignIds = state.processingDesignIds.filter(
          (id) => id !== action.payload.designId,
        );
      }
    },
    hydrateFromStorage(state, action: PayloadAction<{ workspaceIds: string[] }>) {
      action.payload.workspaceIds.forEach((wsId) => {
        const dest = safeGet(LS_DESTINATION_PREFIX + wsId);
        if (dest === 'local' || dest === 'cloud') {
          state.destinationByWorkspace[wsId] = dest;
        }
        const target = safeGet(LS_CLOUD_TARGET_PREFIX + wsId);
        if (target) {
          try {
            state.cloudTargetByWorkspace[wsId] = JSON.parse(target) as UpscaleCloudTarget;
          } catch {
            // ignore corrupted entry
          }
        }
      });
    },
  },
});

export const {
  setActiveBatch,
  openDrawer,
  closeDrawer,
  toggleHideCompleted,
  setDestination,
  setCloudTarget,
  addProcessingDesignId,
  removeProcessingDesignId,
  recordCompletion,
  hydrateFromStorage,
} = upscaleSlice.actions;

export default upscaleSlice.reducer;
