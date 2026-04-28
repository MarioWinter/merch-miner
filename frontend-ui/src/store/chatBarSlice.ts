import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  DrawerPanel,
  ModeOverride,
  SearchSource,
  SourceItem,
} from '../types/search';

/**
 * PROJ-20 AC-12/AC-45: niche-context chip rendered atomically inside the
 * ChatInputBar textarea. Replaces legacy `nicheContext` with the same shape
 * (`niche_id` / `niche_name`) — chip is the single source of truth on send.
 */
export interface InputChip {
  niche_id: string;
  niche_name: string;
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
  /**
   * PROJ-20 AC-12/AC-45: niche-context chip — drives `niche_id` on send.
   * Renamed from legacy `nicheContext` (same shape `{niche_id, niche_name}`).
   */
  inputChip: InputChip | null;
  /** PROJ-17 AC-35: id of the niche shown in the Niche panel (null = create mode). */
  activeNicheId: string | null;
  /** PROJ-17 AC-35: niche panel mode — 'create' shows form, 'edit' loads pipeline. */
  nicheMode: NicheMode;
  /** Whether a search is currently in progress */
  searching: boolean;
  /** Current search sources */
  searchSources: SearchSource[];
  /** Selected LLM model */
  selectedModel: string;
  /**
   * PROJ-20 refactor (2026-04-28): binary Chat/Agent surface — bidirectionally
   * bound to `activePanel` ('chat'/'agent' tabs). Replaces the legacy auto/
   * web_search/agent triad. 'niche' tab is independent (does not touch mode).
   */
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
  inputChip: null,
  activeNicheId: null,
  nicheMode: 'edit',
  searching: false,
  searchSources: ['web'],
  selectedModel: 'gpt-4.1-mini',
  modeOverride: 'chat',
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
        // PROJ-20 refactor (2026-04-28): tab → mode bidirectional sync.
        if (action.payload === 'chat') state.modeOverride = 'chat';
        else if (action.payload === 'agent') state.modeOverride = 'agent';
        // 'niche' tab is independent — leave modeOverride untouched.
      }
    },
    closeDrawer(state) {
      state.drawerOpen = false;
    },
    setActivePanel(state, action: PayloadAction<DrawerPanel>) {
      state.activePanel = action.payload;
      // PROJ-20 refactor (2026-04-28): tab → mode bidirectional sync.
      if (action.payload === 'chat') state.modeOverride = 'chat';
      else if (action.payload === 'agent') state.modeOverride = 'agent';
      // 'niche' leaves modeOverride untouched.
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
    /**
     * PROJ-20 AC-12/AC-45: set the atomic niche-chip. `null` clears the chip.
     */
    setInputChip(state, action: PayloadAction<InputChip | null>) {
      state.inputChip = action.payload;
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
    setSearchSources(state, action: PayloadAction<SearchSource[]>) {
      state.searchSources = action.payload;
    },
    setSelectedModel(state, action: PayloadAction<string>) {
      state.selectedModel = action.payload;
    },
    setModeOverride(state, action: PayloadAction<ModeOverride>) {
      state.modeOverride = action.payload;
      // PROJ-20 refactor (2026-04-28): mode → tab bidirectional sync. Only
      // sync when we're already on a chat/agent tab — leaving 'niche' alone
      // means selecting a mode while editing a niche won't yank the user
      // away from the niche surface.
      if (state.activePanel === 'chat' || state.activePanel === 'agent') {
        state.activePanel = action.payload;
      }
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
  setInputChip,
  setActiveNicheId,
  setNicheMode,
  openNicheCreate,
  openNicheEdit,
  setSearching,
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
