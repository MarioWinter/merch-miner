import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import collectedItemsReducer, {
  toggleSlogan,
  toggleKeyword,
  removeSlogan,
  clearAll,
  selectCollectedSlogans,
  selectCollectedKeywords,
  selectCollectedCount,
} from '../collectedItemsSlice';
import type { RootState } from '../index';

const createStore = () =>
  configureStore({
    reducer: { collectedItems: collectedItemsReducer },
  });

/** Helper to get typed state matching the selectors' expected shape */
const getState = (store: ReturnType<typeof createStore>): RootState =>
  store.getState() as unknown as RootState;

describe('collectedItemsSlice', () => {
  describe('toggleSlogan', () => {
    it('adds slogan when not present', () => {
      const store = createStore();
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'Best Dad Ever' }));

      expect(selectCollectedSlogans(getState(store), 'n1')).toEqual([
        'Best Dad Ever',
      ]);
    });

    it('removes slogan when already present (toggle off)', () => {
      const store = createStore();
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'Best Dad Ever' }));
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'Best Dad Ever' }));

      expect(selectCollectedSlogans(getState(store), 'n1')).toEqual([]);
    });
  });

  describe('toggleKeyword', () => {
    it('adds keyword when not present', () => {
      const store = createStore();
      store.dispatch(toggleKeyword({ nicheId: 'n1', value: 'fishing' }));

      expect(selectCollectedKeywords(getState(store), 'n1')).toEqual([
        'fishing',
      ]);
    });

    it('removes keyword when already present (toggle off)', () => {
      const store = createStore();
      store.dispatch(toggleKeyword({ nicheId: 'n1', value: 'fishing' }));
      store.dispatch(toggleKeyword({ nicheId: 'n1', value: 'fishing' }));

      expect(selectCollectedKeywords(getState(store), 'n1')).toEqual([]);
    });
  });

  describe('removeSlogan', () => {
    it('removes specific slogan', () => {
      const store = createStore();
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'A' }));
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'B' }));
      store.dispatch(removeSlogan({ nicheId: 'n1', value: 'A' }));

      expect(selectCollectedSlogans(getState(store), 'n1')).toEqual(['B']);
    });

    it('does nothing for unknown niche', () => {
      const store = createStore();
      store.dispatch(removeSlogan({ nicheId: 'unknown', value: 'A' }));

      expect(selectCollectedSlogans(getState(store), 'unknown')).toEqual([]);
    });
  });

  describe('clearAll', () => {
    it('removes all items for a niche', () => {
      const store = createStore();
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'slogan' }));
      store.dispatch(toggleKeyword({ nicheId: 'n1', value: 'keyword' }));
      store.dispatch(clearAll({ nicheId: 'n1' }));

      expect(selectCollectedSlogans(getState(store), 'n1')).toEqual([]);
      expect(selectCollectedKeywords(getState(store), 'n1')).toEqual([]);
      expect(selectCollectedCount(getState(store), 'n1')).toBe(0);
    });

    it('does not affect other niches', () => {
      const store = createStore();
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'a' }));
      store.dispatch(toggleSlogan({ nicheId: 'n2', value: 'b' }));
      store.dispatch(clearAll({ nicheId: 'n1' }));

      expect(selectCollectedSlogans(getState(store), 'n2')).toEqual(['b']);
    });
  });

  describe('selectors', () => {
    it('selectCollectedSlogans returns empty array for unknown niche', () => {
      const store = createStore();
      expect(selectCollectedSlogans(getState(store), 'nope')).toEqual([]);
    });

    it('selectCollectedCount returns correct total (slogans + keywords)', () => {
      const store = createStore();
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'a' }));
      store.dispatch(toggleSlogan({ nicheId: 'n1', value: 'b' }));
      store.dispatch(toggleKeyword({ nicheId: 'n1', value: 'k1' }));

      expect(selectCollectedCount(getState(store), 'n1')).toBe(3);
    });

    it('selectCollectedCount returns 0 for unknown niche', () => {
      const store = createStore();
      expect(selectCollectedCount(getState(store), 'nope')).toBe(0);
    });
  });
});
