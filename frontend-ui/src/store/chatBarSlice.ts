import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { DrawerPanel, SearchMode, SearchSource } from '../types/search';

interface NicheContext {
  id: string;
  name: string;
}

interface ChatBarState {
  /** Whether the floating chat bar is expanded (input visible) */
  barExpanded: boolean;
  /** Whether the bar is completely hidden (user dismissed it) */
  barHidden: boolean;
  /** The multi-purpose drawer open state */
  drawerOpen: boolean;
  /** Active drawer panel */
  activePanel: DrawerPanel;
  /** Currently active chat session ID */
  activeSessionId: string | null;
  /** Niche context for the current chat */
  nicheContext: NicheContext | null;
  /** Whether a search is currently in progress */
  searching: boolean;
  /** Current search mode */
  searchMode: SearchMode;
  /** Current search sources */
  searchSources: SearchSource[];
  /** Selected LLM model */
  selectedModel: string;
}

const initialState: ChatBarState = {
  barExpanded: false,
  barHidden: false,
  drawerOpen: false,
  activePanel: 'niche',
  activeSessionId: null,
  nicheContext: null,
  searching: false,
  searchMode: 'balanced',
  searchSources: ['web'],
  selectedModel: 'gpt-4.1-mini',
};

const chatBarSlice = createSlice({
  name: 'chatBar',
  initialState,
  reducers: {
    expandBar(state) {
      state.barExpanded = true;
      state.barHidden = false;
    },
    collapseBar(state) {
      state.barExpanded = false;
    },
    hideBar(state) {
      state.barExpanded = false;
      state.barHidden = true;
    },
    showBar(state) {
      state.barHidden = false;
    },
    openDrawer(state, action: PayloadAction<DrawerPanel | undefined>) {
      state.drawerOpen = true;
      if (action.payload) {
        state.activePanel = action.payload;
      }
    },
    closeDrawer(state) {
      state.drawerOpen = false;
    },
    setActivePanel(state, action: PayloadAction<DrawerPanel>) {
      state.activePanel = action.payload;
    },
    setActiveSession(state, action: PayloadAction<string | null>) {
      state.activeSessionId = action.payload;
    },
    setNicheContext(state, action: PayloadAction<NicheContext | null>) {
      state.nicheContext = action.payload;
    },
    setSearching(state, action: PayloadAction<boolean>) {
      state.searching = action.payload;
    },
    setSearchMode(state, action: PayloadAction<SearchMode>) {
      state.searchMode = action.payload;
    },
    setSearchSources(state, action: PayloadAction<SearchSource[]>) {
      state.searchSources = action.payload;
    },
    setSelectedModel(state, action: PayloadAction<string>) {
      state.selectedModel = action.payload;
    },
  },
});

export const {
  expandBar,
  collapseBar,
  hideBar,
  showBar,
  openDrawer,
  closeDrawer,
  setActivePanel,
  setActiveSession,
  setNicheContext,
  setSearching,
  setSearchMode,
  setSearchSources,
  setSelectedModel,
} = chatBarSlice.actions;

export default chatBarSlice.reducer;
