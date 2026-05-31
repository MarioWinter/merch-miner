import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  DrawerPanel,
  ModeOverride,
  SearchSource,
  SourceItem,
} from '../types/search';
import type {
  ChunkUsed,
  FlashCitation,
  SloganRow,
  ThinkingStep,
} from '../types/chat-rag';

/**
 * PROJ-20 AC-12/AC-45: niche-context chip rendered atomically inside the
 * ChatInputBar textarea. Replaces legacy `nicheContext` with the same shape
 * (`niche_id` / `niche_name`) — chip is the single source of truth on send.
 */
export interface InputChip {
  niche_id: string;
  niche_name: string;
}

/** Stepless drawer width in px; clamped at the slice boundary. */
export type DrawerWidth = number;
export const DRAWER_WIDTH_MIN = 380;
export const DRAWER_WIDTH_MAX = 1400;
export const DRAWER_WIDTH_DEFAULT = 768;

/** `overlap` = floats over content (default); `sideBySide` = pushes main column. */
export type DrawerLayout = 'overlap' | 'sideBySide';

/** Niche panel mode — drives whether NichePipeline renders the create form or the edit pipeline. */
export type NicheMode = 'create' | 'edit';

/**
 * FIX-dashboard-bug-report-and-polish Item 9 — speed-mode bypass knob.
 * Per-user-session preference forwarded as `optimization_mode` on the chat
 * stream request. Re-introduces the slot that was removed in PROJ-20 once
 * the Vane mode was hardcoded to `'speed'` for cost control.
 */
export type SearchMode = 'speed' | 'balanced' | 'quality';

export const SEARCH_MODES: readonly SearchMode[] = ['speed', 'balanced', 'quality'] as const;
export const DEFAULT_SEARCH_MODE: SearchMode = 'speed';

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
  /** The multi-purpose drawer open state */
  drawerOpen: boolean;
  /** Drawer width (stepless, clamped 380–1400px in `useDrawerResize`) */
  drawerWidth: DrawerWidth;
  /** Drawer layout mode — overlap (default) or side-by-side with main content */
  drawerLayout: DrawerLayout;
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
   * FIX-dashboard-bug-report-and-polish Item 9 — Vane search-depth knob.
   * Default `'speed'`. Forwarded as `optimization_mode` on the stream request.
   */
  searchMode: SearchMode;
  /**
   * PROJ-20 refactor (2026-04-28): binary Chat/Agent surface — bidirectionally
   * bound to `activePanel` ('chat'/'agent' tabs). Replaces the legacy auto/
   * web_search/agent triad. 'niche' tab is independent (does not touch mode).
   */
  modeOverride: ModeOverride;
  /** PROJ-17 Phase 4 Step 6: live SSE streaming bubble state */
  streamingAssistantMessage: StreamingAssistantMessage;
  /** Whether the chat-history overlay (full-panel) is open. Triggered from drawer header icon. */
  recentChatsOverlayOpen: boolean;
  /**
   * PROJ-29 Phase 1H — ThinkingStrip rows emitted by SSE `stage`/`tool_call`/`tool_result`.
   * FIFO-capped at NICHE_RAG_MAX_STAGES (50). Cleared on every new `init` / `clearStreamingMessage`.
   */
  streamingStages: ThinkingStep[];
  /**
   * PROJ-29 Phase 1H — consolidated chunks emitted by SSE `chunks_used`.
   * FIFO-capped at NICHE_RAG_MAX_CHUNKS (200) to bound memory across a session.
   * Cleared on every new `init` / `clearStreamingMessage`.
   */
  chunksUsed: ChunkUsed[];
  /**
   * PROJ-29 Phase 1H — 3 follow-up chips emitted by SSE `follow_ups` (after `done`).
   * Max 3 entries. Cleared on the next user message (not on stream-clear) so the
   * chips persist next to the just-finished assistant answer until the user types.
   */
  followUps: string[];
  /** PROJ-29 Phase 1H — ms-epoch when the current stream started (init event). */
  streamStartedAt: number | null;
  /**
   * PROJ-29 Phase 1H — citation flash pub/sub. Hover [NICHE:N] sets this; the
   * ExpandedPanel reads it and flashes the matching row, then resets to null.
   */
  flashCitation: FlashCitation | null;
  /**
   * PROJ-29 Phase 1H-2 — structured slogan payload streamed in via the
   * `generate_slogans_payload` SSE event. Lives on the streaming assistant
   * message during the active stream.
   */
  streamingSloganPayload: SloganRow[] | null;
  /**
   * PROJ-29 Phase 1H-2 — payload that survives `done` so the just-persisted
   * assistant message can keep rendering its slogan table. Captured from
   * `streamingSloganPayload` on `done`, keyed by the persisted message id.
   * Cleared on next `init` (new user message). Workaround until the backend
   * persists generate_slogans_payload on the ChatMessage row (Phase 1I).
   */
  completedSloganPayload: { messageId: string; rows: SloganRow[] } | null;
}

const INITIAL_STREAM: StreamingAssistantMessage = {
  id: null,
  content: '',
  sources: [],
  isStreaming: false,
};

/** PROJ-29 Phase 1H — FIFO caps to bound Redux growth across long agent turns. */
const MAX_STREAMING_STAGES = 50;
const MAX_CHUNKS_USED = 200;
const MAX_FOLLOW_UPS = 3;

/**
 * Persisted slice keys (localStorage). Read on hydration, written on each
 * relevant action so a reload preserves the last-opened niche, etc.
 * Wrapped in try/catch — Safari private mode + SSR-safety guards.
 */
const STORAGE_KEY = 'merchminer.chatBar.persisted';

interface PersistedFields {
  activeNicheId: string | null;
  nicheMode: NicheMode;
}

const readPersisted = (): Partial<PersistedFields> => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PersistedFields>;
    return {
      activeNicheId:
        typeof parsed.activeNicheId === 'string' ? parsed.activeNicheId : null,
      nicheMode: parsed.nicheMode === 'create' ? 'create' : 'edit',
    };
  } catch {
    return {};
  }
};

const writePersisted = (state: ChatBarState): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload: PersistedFields = {
      activeNicheId: state.activeNicheId,
      nicheMode: state.nicheMode,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / privacy — ignore */
  }
};

const persisted = readPersisted();

/**
 * FIX-dashboard-bug-report-and-polish Item 9 — global `chat-search-mode` slot.
 * Persisted under a workspace-agnostic key because the slice initializes
 * before the active workspace id is known. EC-9-1: any value outside the
 * valid `SearchMode` union falls back to `'speed'`.
 * TODO: per-workspace key once workspaceId is available in slice init.
 */
const SEARCH_MODE_STORAGE_KEY = 'chat-search-mode-global';

const isSearchMode = (value: unknown): value is SearchMode =>
  value === 'speed' || value === 'balanced' || value === 'quality';

const readPersistedSearchMode = (): SearchMode => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_SEARCH_MODE;
  }
  try {
    const raw = window.localStorage.getItem(SEARCH_MODE_STORAGE_KEY);
    return isSearchMode(raw) ? raw : DEFAULT_SEARCH_MODE;
  } catch {
    return DEFAULT_SEARCH_MODE;
  }
};

const writePersistedSearchMode = (mode: SearchMode): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SEARCH_MODE_STORAGE_KEY, mode);
  } catch {
    /* quota / privacy — ignore */
  }
};

const initialState: ChatBarState = {
  drawerOpen: false,
  drawerWidth: DRAWER_WIDTH_DEFAULT,
  drawerLayout: 'overlap',
  activePanel: 'chat',
  activeSessionId: null,
  activeAgentSessionId: null,
  inputChip: null,
  activeNicheId: persisted.activeNicheId ?? null,
  nicheMode: persisted.nicheMode ?? 'edit',
  searching: false,
  searchSources: ['web'],
  selectedModel: 'openai/gpt-4.1-mini',
  searchMode: readPersistedSearchMode(),
  modeOverride: 'chat',
  streamingAssistantMessage: INITIAL_STREAM,
  recentChatsOverlayOpen: false,
  streamingStages: [],
  chunksUsed: [],
  followUps: [],
  streamStartedAt: null,
  flashCitation: null,
  streamingSloganPayload: null,
  completedSloganPayload: null,
};

const chatBarSlice = createSlice({
  name: 'chatBar',
  initialState,
  reducers: {
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
      // Clamp at the boundary so direct callers can't bypass the hook.
      state.drawerWidth = Math.max(
        DRAWER_WIDTH_MIN,
        Math.min(DRAWER_WIDTH_MAX, action.payload),
      );
    },
    setDrawerLayout(state, action: PayloadAction<DrawerLayout>) {
      state.drawerLayout = action.payload;
    },
    toggleDrawerLayout(state) {
      state.drawerLayout =
        state.drawerLayout === 'overlap' ? 'sideBySide' : 'overlap';
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
      writePersisted(state);
    },
    setNicheMode(state, action: PayloadAction<NicheMode>) {
      state.nicheMode = action.payload;
      writePersisted(state);
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
      writePersisted(state);
    },
    /**
     * PROJ-17 AC-35: open the Niche panel in edit mode for a specific niche.
     */
    openNicheEdit(state, action: PayloadAction<string>) {
      state.activeNicheId = action.payload;
      state.nicheMode = 'edit';
      state.activePanel = 'niche';
      state.drawerOpen = true;
      writePersisted(state);
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
    /**
     * FIX-dashboard-bug-report-and-polish Item 9 — set the per-session search
     * depth and persist to localStorage so reload restores the preference.
     */
    setSearchMode(state, action: PayloadAction<SearchMode>) {
      state.searchMode = action.payload;
      writePersistedSearchMode(action.payload);
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
      // PROJ-29 Phase 1H — also reset ThinkingStrip state for the new turn
      // and timestamp the stream start (drives elapsed-seconds in CompactStrip).
      state.streamingStages = [];
      state.chunksUsed = [];
      state.streamStartedAt = Date.now();
      // 1H-2: drop the previous turn's completed slogan payload so the table
      // doesn't bleed across turns.
      state.completedSloganPayload = null;
      state.streamingSloganPayload = null;
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
      // PROJ-29 Phase 1H — wipe ThinkingStrip state when the stream ends.
      // `followUps` is intentionally NOT cleared here — chips persist next to
      // the just-finished assistant answer until the user types a new message
      // (use `clearFollowUps` for that).
      state.streamingStages = [];
      state.chunksUsed = [];
      state.streamStartedAt = null;
      state.flashCitation = null;
      state.streamingSloganPayload = null;
    },
    // --- PROJ-29 Phase 1H: ThinkingStrip reducers ---
    /**
     * Push a new stage onto the strip with status='loading'. If a row for the
     * same `stage` already exists in loading state, this is a no-op (the
     * tool_call/result pair handles status transitions). Otherwise, FIFO-cap.
     */
    pushStreamingStage(state, action: PayloadAction<ThinkingStep>) {
      const incoming = action.payload;
      // Avoid duplicate consecutive loading rows for the same stage — the SSE
      // protocol may emit both `stage` + `tool_call` for a single tool turn.
      const lastLoading = [...state.streamingStages]
        .reverse()
        .find((s) => s.stage === incoming.stage && s.status === 'loading');
      if (lastLoading) return;
      state.streamingStages.push(incoming);
      if (state.streamingStages.length > MAX_STREAMING_STAGES) {
        // FIFO evict oldest
        state.streamingStages.splice(
          0,
          state.streamingStages.length - MAX_STREAMING_STAGES,
        );
      }
    },
    /**
     * Transition the most recent loading row for `stage` → done.
     * Sets durationMs from the stored ts.
     */
    markStageDone(
      state,
      action: PayloadAction<{ stage: string; ts: number }>,
    ) {
      const { stage, ts } = action.payload;
      for (let i = state.streamingStages.length - 1; i >= 0; i -= 1) {
        const row = state.streamingStages[i];
        if (row.stage === stage && row.status === 'loading') {
          row.status = 'done';
          row.durationMs = Math.max(0, ts - row.ts);
          return;
        }
      }
    },
    /**
     * Transition the most recent loading row for `stage` → warning (tool_timeout, etc.).
     * Optional `reason` lets callers tag the cause (currently only
     * `'tool_timeout'`) so the post-done downgrader can target the right rows.
     */
    markStageWarning(
      state,
      action: PayloadAction<{ stage: string; message?: string; reason?: 'tool_timeout' }>,
    ) {
      const { stage, message, reason } = action.payload;
      for (let i = state.streamingStages.length - 1; i >= 0; i -= 1) {
        const row = state.streamingStages[i];
        if (row.stage === stage && row.status === 'loading') {
          row.status = 'warning';
          if (message) row.message = message;
          if (reason) row.reason = reason;
          return;
        }
      }
    },
    /**
     * FIX-dashboard Item 7 — downgrade tool_timeout warnings to `info` when
     * the LLM still returned a substantive answer (>200 chars). The original
     * timeout signal is misleading in that case: the search was slow but the
     * final answer used alternate sources, so the user shouldn't see an
     * orange warning chip next to a long, useful response.
     *
     * Rules (AC-7-1..5):
     *   - Only rows with status='warning' AND reason='tool_timeout' are
     *     candidates (no other warning sources today, but defensive).
     *   - Only if the final answer length > 200 chars.
     *   - Rewrite `message` to a localized "search slower than expected"
     *     string the caller supplies (slice doesn't know t()).
     *   - ALL matching rows are downgraded (EC-7-2).
     *   - No-op if no warnings present or answer ≤ 200 chars.
     */
    downgradeTimeoutWarningsOnDone(
      state,
      action: PayloadAction<{ finalAnswerLength: number; downgradedMessage: string }>,
    ) {
      const { finalAnswerLength, downgradedMessage } = action.payload;
      if (finalAnswerLength <= 200) return;
      for (const row of state.streamingStages) {
        if (row.status === 'warning' && row.reason === 'tool_timeout') {
          row.status = 'info';
          row.message = downgradedMessage;
        }
      }
    },
    /**
     * Mark the most recent loading row as error (used by global SSE `error` handler).
     * Stage param optional — defaults to whichever row is still loading.
     */
    markStageError(
      state,
      action: PayloadAction<{ stage?: string; message?: string }>,
    ) {
      const { stage, message } = action.payload;
      for (let i = state.streamingStages.length - 1; i >= 0; i -= 1) {
        const row = state.streamingStages[i];
        const stageMatch = stage ? row.stage === stage : true;
        if (stageMatch && row.status === 'loading') {
          row.status = 'error';
          if (message) row.message = message;
          return;
        }
      }
    },
    /**
     * Append a batch of `chunks_used` rows; FIFO-cap at 200 per turn.
     */
    appendChunksUsed(state, action: PayloadAction<ChunkUsed[]>) {
      if (!Array.isArray(action.payload) || action.payload.length === 0) return;
      state.chunksUsed.push(...action.payload);
      if (state.chunksUsed.length > MAX_CHUNKS_USED) {
        state.chunksUsed.splice(
          0,
          state.chunksUsed.length - MAX_CHUNKS_USED,
        );
      }
    },
    /** Replace follow-up chips (caller has already sliced to 3). */
    setFollowUps(state, action: PayloadAction<string[]>) {
      state.followUps = action.payload.slice(0, MAX_FOLLOW_UPS);
    },
    /** Clear follow-up chips — fires on next user message. */
    clearFollowUps(state) {
      state.followUps = [];
    },
    /** Override stream start timestamp (used by SSE `init` handler). */
    setStreamStartedAt(state, action: PayloadAction<number | null>) {
      state.streamStartedAt = action.payload;
    },
    /** Trigger a citation flash; ExpandedPanel resets via `clearFlashCitation`. */
    setFlashCitation(state, action: PayloadAction<FlashCitation | null>) {
      state.flashCitation = action.payload;
    },
    clearFlashCitation(state) {
      state.flashCitation = null;
    },
    /**
     * PROJ-29 Phase 1H-2 — set the structured slogan payload streamed in via
     * the `generate_slogans_payload` SSE event. Cleared on stream end +
     * on next `init`.
     */
    setStreamingSloganPayload(state, action: PayloadAction<SloganRow[] | null>) {
      state.streamingSloganPayload = action.payload;
    },
    /**
     * PROJ-29 Phase 1H-2 — capture the streaming payload on `done` so the
     * just-persisted assistant message can keep rendering its slogan table.
     */
    setCompletedSloganPayload(
      state,
      action: PayloadAction<{ messageId: string; rows: SloganRow[] } | null>,
    ) {
      state.completedSloganPayload = action.payload;
    },
    /**
     * PROJ-29 Phase 1H-2 — atomically move the streaming payload to
     * `completedSloganPayload` keyed by the persisted message id. Called from
     * the SSE `done` handler before `clearStreamingMessage` runs.
     */
    promoteStreamingSloganPayload(state, action: PayloadAction<{ messageId: string }>) {
      if (state.streamingSloganPayload && state.streamingSloganPayload.length > 0) {
        state.completedSloganPayload = {
          messageId: action.payload.messageId,
          rows: state.streamingSloganPayload,
        };
      }
    },
    setRecentChatsOverlayOpen(state, action: PayloadAction<boolean>) {
      state.recentChatsOverlayOpen = action.payload;
    },
    /**
     * Start a fresh chat session — clears active session, streaming state,
     * niche chip, search flag, attachments-overlay and switches to chat tab.
     * Triggered by the "+" icon in the drawer header.
     */
    startNewChat(state) {
      state.activeSessionId = null;
      state.streamingAssistantMessage = INITIAL_STREAM;
      state.inputChip = null;
      state.searching = false;
      state.recentChatsOverlayOpen = false;
      state.activePanel = 'chat';
      state.drawerOpen = true;
      // PROJ-29 Phase 1H — also reset ThinkingStrip + follow-ups + chunks
      state.streamingStages = [];
      state.chunksUsed = [];
      state.followUps = [];
      state.streamStartedAt = null;
      state.flashCitation = null;
    },
    /**
     * PROJ-29 Phase 1F: full reset of chat-scoped slice state. Used on
     * logout so the next user signing in on the same browser does not see
     * the previous user's active session id, streaming buffer, niche chip,
     * or drawer-open state.
     */
    resetChatBar() {
      // Re-read persisted (workspace) fields — but those are wiped by the
      // logout cleanup separately via `mm-active-chat-*` removal + the
      // workspace slice's own reducer. We deliberately return a fresh
      // initial state shape minus the persisted-niche fields.
      return {
        ...initialState,
        activeNicheId: null,
        nicheMode: 'edit' as NicheMode,
      };
    },
  },
});

export const {
  openDrawer,
  closeDrawer,
  setActivePanel,
  setDrawerWidth,
  setDrawerLayout,
  toggleDrawerLayout,
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
  setSearchMode,
  setModeOverride,
  setStreamingAssistantMessage,
  appendStreamingChunk,
  appendStreamingSources,
  setStreamingActive,
  clearStreamingMessage,
  setRecentChatsOverlayOpen,
  startNewChat,
  resetChatBar,
  // PROJ-29 Phase 1H — ThinkingStrip + follow-ups + chunks + flash-citation
  pushStreamingStage,
  markStageDone,
  markStageWarning,
  downgradeTimeoutWarningsOnDone,
  markStageError,
  appendChunksUsed,
  setFollowUps,
  clearFollowUps,
  setStreamStartedAt,
  setFlashCitation,
  clearFlashCitation,
  setStreamingSloganPayload,
  setCompletedSloganPayload,
  promoteStreamingSloganPayload,
} = chatBarSlice.actions;

/**
 * FIX-dashboard-bug-report-and-polish Item 9 — typed selector for the search
 * depth knob. Components may also read `s.chatBar.searchMode` directly.
 */
export const selectSearchMode = (state: { chatBar: ChatBarState }): SearchMode =>
  state.chatBar.searchMode;

export default chatBarSlice.reducer;
