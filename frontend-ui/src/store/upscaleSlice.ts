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
}

const initialState: UpscaleSliceState = {
  activeBatchId: safeGet(LS_ACTIVE_BATCH),
  drawerOpen: false,
  destinationByWorkspace: {},
  cloudTargetByWorkspace: {},
  hideCompletedInDrawer: false,
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
  hydrateFromStorage,
} = upscaleSlice.actions;

export default upscaleSlice.reducer;
