import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  DrawerPanel,
  ModeOverride,
  SearchMode,
  SearchSource,
  SourceItem,
} from '../types/search';

interface NicheContext {
  id: string;
  name: string;
}

/** Drawer width steps (px) — single-column / split-view / NotebookLM full command center */
export type DrawerWidth = 480 | 768 | 1200;

/** Niche panel mode — drives whether NichePipeline renders the create form or the edit pipeline. */
export type NicheMode = 'create' | 'edit';

/**
 * PROJ-17 Phase 4 Step 6: virtual streaming assistant message rendered live in
 * ChatMessageList while the SSE stream is active. Cleared on `done`/`error`,
 * after which the persisted message arrives via RTK Query refetch.
 */
export interface StreamingAssistantMessage {
  id: string | null;
  content: string;
  sources: SourceItem[];
  isStreaming: boolean;
}

interface ChatBarState {
  /** Whether the floating chat bar is expanded (input visible). When false, only the chevron indicator is shown. */
  barExpanded: boolean;
  /** The multi-purpose drawer open state */
  drawerOpen: boolean;
  /** Drawer width (snaps to 480/768/1200) */
  drawerWidth: DrawerWidth;
  /** Active drawer panel */
  activePanel: DrawerPanel;
  /** Currently active chat session ID */
  activeSessionId: string | null;
  /** Active agent session id (set when WorkflowCard "Open Command Center" link clicked → AgentPanel scrolls to it) */
  activeAgentSessionId: string | null;
  /** Niche context for the current chat */
  nicheContext: NicheContext | null;
  /** PROJ-17 AC-35: id of the niche shown in the Niche panel (null = create mode). */
  activeNicheId: string | null;
  /** PROJ-17 AC-35: niche panel mode — 'create' shows form, 'edit' loads pipeline. */
  nicheMode: NicheMode;
  /** Whether a search is currently in progress */
  searching: boolean;
  /** Current search mode */
  searchMode: SearchMode;
  /** Current search sources */
  searchSources: SearchSource[];
  /** Selected LLM model */
  selectedModel: string;
  /** PROJ-17 AC-41: routing override (auto = LLM classifier, web_search = force Vane, agent = force PROJ-18) */
  modeOverride: ModeOverride;
  /** PROJ-17 Phase 4 Step 6: live SSE streaming bubble state */
  streamingAssistantMessage: StreamingAssistantMessage;
}

const INITIAL_STREAM: StreamingAssistantMessage = {
  id: null,
  content: '',
  sources: [],
  isStreaming: false,
};

const initialState: ChatBarState = {
  barExpanded: false,
  drawerOpen: false,
  drawerWidth: 480,
  activePanel: 'chat',
  activeSessionId: null,
  activeAgentSessionId: null,
  nicheContext: null,
  activeNicheId: null,
  nicheMode: 'edit',
  searching: false,
  searchMode: 'balanced',
  searchSources: ['web'],
  selectedModel: 'gpt-4.1-mini',
  modeOverride: 'auto',
  streamingAssistantMessage: INITIAL_STREAM,
};

const chatBarSlice = createSlice({
  name: 'chatBar',
  initialState,
  reducers: {
    expandBar(state) {
      state.barExpanded = true;
    },
    collapseBar(state) {
      state.barExpanded = false;
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
    setDrawerWidth(state, action: PayloadAction<DrawerWidth>) {
      state.drawerWidth = action.payload;
    },
    setActiveSession(state, action: PayloadAction<string | null>) {
      state.activeSessionId = action.payload;
    },
    setActiveAgentSessionId(state, action: PayloadAction<string | null>) {
      state.activeAgentSessionId = action.payload;
    },
    setNicheContext(state, action: PayloadAction<NicheContext | null>) {
      state.nicheContext = action.payload;
    },
    setActiveNicheId(state, action: PayloadAction<string | null>) {
      state.activeNicheId = action.payload;
    },
    setNicheMode(state, action: PayloadAction<NicheMode>) {
      state.nicheMode = action.payload;
    },
    /**
     * PROJ-17 AC-35: open the Niche panel in create mode.
     * Clears activeNicheId, sets niche tab active, opens the drawer.
     */
    openNicheCreate(state) {
      state.activeNicheId = null;
      state.nicheMode = 'create';
      state.activePanel = 'niche';
      state.drawerOpen = true;
    },
    /**
     * PROJ-17 AC-35: open the Niche panel in edit mode for a specific niche.
     */
    openNicheEdit(state, action: PayloadAction<string>) {
      state.activeNicheId = action.payload;
      state.nicheMode = 'edit';
      state.activePanel = 'niche';
      state.drawerOpen = true;
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
    setModeOverride(state, action: PayloadAction<ModeOverride>) {
      state.modeOverride = action.payload;
    },
    // --- PROJ-17 Phase 4 Step 6: SSE streaming reducers ---
    setStreamingAssistantMessage(
      state,
      action: PayloadAction<{ id: string; sources?: SourceItem[]; content?: string }>,
    ) {
      state.streamingAssistantMessage = {
        id: action.payload.id,
        content: action.payload.content ?? '',
        sources: action.payload.sources ?? [],
        isStreaming: true,
      };
    },
    appendStreamingChunk(state, action: PayloadAction<string>) {
      if (state.streamingAssistantMessage.isStreaming) {
        state.streamingAssistantMessage.content += action.payload;
      }
    },
    appendStreamingSources(state, action: PayloadAction<SourceItem[]>) {
      if (state.streamingAssistantMessage.isStreaming) {
        // Replace if first batch, otherwise concat (Vane usually emits once)
        if (state.streamingAssistantMessage.sources.length === 0) {
          state.streamingAssistantMessage.sources = action.payload;
        } else {
          state.streamingAssistantMessage.sources = [
            ...state.streamingAssistantMessage.sources,
            ...action.payload,
          ];
        }
      }
    },
    setStreamingActive(state, action: PayloadAction<boolean>) {
      state.streamingAssistantMessage.isStreaming = action.payload;
    },
    clearStreamingMessage(state) {
      state.streamingAssistantMessage = INITIAL_STREAM;
    },
  },
});

export const {
  expandBar,
  collapseBar,
  openDrawer,
  closeDrawer,
  setActivePanel,
  setDrawerWidth,
  setActiveSession,
  setActiveAgentSessionId,
  setNicheContext,
  setActiveNicheId,
  setNicheMode,
  openNicheCreate,
  openNicheEdit,
  setSearching,
  setSearchMode,
  setSearchSources,
  setSelectedModel,
  setModeOverride,
  setStreamingAssistantMessage,
  appendStreamingChunk,
  appendStreamingSources,
  setStreamingActive,
  clearStreamingMessage,
} = chatBarSlice.actions;

export default chatBarSlice.reducer;
