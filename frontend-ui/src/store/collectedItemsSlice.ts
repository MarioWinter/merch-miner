import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

/**
 * CollectedItems state.
 * - Slogans: tracked here for optimistic UI, but persisted via ideaApi mutations.
 *   The toggleSlogan action is dispatched alongside the RTK mutation in components.
 * - Keywords: Redux-only (persist to Keyword Bank in PROJ-10).
 */
interface CollectedItems {
  slogans: string[];
  keywords: string[];
}

interface CollectedItemsState {
  byNicheId: Record<string, CollectedItems>;
}

const initialState: CollectedItemsState = {
  byNicheId: {},
};

const ensureNiche = (state: CollectedItemsState, nicheId: string): CollectedItems => {
  if (!state.byNicheId[nicheId]) {
    state.byNicheId[nicheId] = { slogans: [], keywords: [] };
  }
  return state.byNicheId[nicheId];
};

interface ItemPayload {
  nicheId: string;
  value: string;
}

interface ClearPayload {
  nicheId: string;
}

const collectedItemsSlice = createSlice({
  name: 'collectedItems',
  initialState,
  reducers: {
    toggleSlogan(state, action: PayloadAction<ItemPayload>) {
      const { nicheId, value } = action.payload;
      const items = ensureNiche(state, nicheId);
      const idx = items.slogans.indexOf(value);
      if (idx >= 0) {
        items.slogans.splice(idx, 1);
      } else {
        items.slogans.push(value);
      }
    },
    toggleKeyword(state, action: PayloadAction<ItemPayload>) {
      const { nicheId, value } = action.payload;
      const items = ensureNiche(state, nicheId);
      const idx = items.keywords.indexOf(value);
      if (idx >= 0) {
        items.keywords.splice(idx, 1);
      } else {
        items.keywords.push(value);
      }
    },
    removeSlogan(state, action: PayloadAction<ItemPayload>) {
      const { nicheId, value } = action.payload;
      const items = state.byNicheId[nicheId];
      if (!items) return;
      const idx = items.slogans.indexOf(value);
      if (idx >= 0) items.slogans.splice(idx, 1);
    },
    rollbackSlogan(state, action: PayloadAction<ItemPayload>) {
      // Undo an optimistic add on API failure
      const { nicheId, value } = action.payload;
      const items = state.byNicheId[nicheId];
      if (!items) return;
      const idx = items.slogans.indexOf(value);
      if (idx >= 0) items.slogans.splice(idx, 1);
    },
    removeKeyword(state, action: PayloadAction<ItemPayload>) {
      const { nicheId, value } = action.payload;
      const items = state.byNicheId[nicheId];
      if (!items) return;
      const idx = items.keywords.indexOf(value);
      if (idx >= 0) items.keywords.splice(idx, 1);
    },
    clearAll(state, action: PayloadAction<ClearPayload>) {
      delete state.byNicheId[action.payload.nicheId];
    },
  },
});

export const {
  toggleSlogan,
  toggleKeyword,
  removeSlogan,
  rollbackSlogan,
  removeKeyword,
  clearAll,
} = collectedItemsSlice.actions;

export const selectCollectedSlogans = (state: RootState, nicheId: string): string[] =>
  state.collectedItems.byNicheId[nicheId]?.slogans ?? [];

export const selectCollectedKeywords = (state: RootState, nicheId: string): string[] =>
  state.collectedItems.byNicheId[nicheId]?.keywords ?? [];

export const selectCollectedCount = (state: RootState, nicheId: string): number => {
  const items = state.collectedItems.byNicheId[nicheId];
  if (!items) return 0;
  return items.slogans.length + items.keywords.length;
};

export default collectedItemsSlice.reducer;
