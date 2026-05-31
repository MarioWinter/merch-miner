import { describe, it, expect, beforeEach, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import chatBarReducer, {
  openDrawer,
  closeDrawer,
  setActivePanel,
  setDrawerWidth,
  setActiveSession,
  setActiveAgentSessionId,
  setInputChip,
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
  pushStreamingStage,
  markStageDone,
  markStageWarning,
  appendChunksUsed,
  setFollowUps,
  clearFollowUps,
  selectSearchMode,
} from '../chatBarSlice';
import type { ChunkUsed, ThinkingStep } from '../../types/chat-rag';

const createStore = () =>
  configureStore({
    reducer: { chatBar: chatBarReducer },
  });

const getChatBar = (store: ReturnType<typeof createStore>) =>
  store.getState().chatBar;

describe('chatBarSlice', () => {
  it('returns the correct initial state', () => {
    const store = createStore();
    const s = getChatBar(store);
    expect(s.drawerOpen).toBe(false);
    // PROJ-29 Phase 1J follow-up: default raised from 480 to 768 (mid-size
    // single-column / split-view) and width is now stepless `number` instead
    // of the `480 | 768 | 1200` snap union.
    expect(s.drawerWidth).toBe(768);
    expect(s.drawerLayout).toBe('overlap');
    expect(s.activePanel).toBe('chat');
    expect(s.activeSessionId).toBeNull();
    expect(s.activeAgentSessionId).toBeNull();
    expect(s.inputChip).toBeNull();
    expect(s.searching).toBe(false);
    expect(s.searchSources).toEqual(['web']);
    expect(s.selectedModel).toBe('openai/gpt-4.1-mini');
    // PROJ-20 refactor: ModeOverride is now binary 'chat' | 'agent'; default is 'chat'.
    expect(s.modeOverride).toBe('chat');
    expect(s.streamingAssistantMessage).toEqual({
      id: null,
      content: '',
      sources: [],
      isStreaming: false,
    });
  });

  // FIX-dashboard-bug-report-and-polish Item 9 (re-introduced 2026-05-31):
  // `searchMode` was removed in PROJ-20 Phase 2; reintroduced here as the
  // Vane `optimization_mode` knob. Defaults to `'speed'` for cost control.
  it('exposes searchMode on initial state with default "speed"', () => {
    const store = createStore();
    const s = getChatBar(store);
    expect(s).toHaveProperty('searchMode');
    expect(s.searchMode).toBe('speed');
  });

  describe('drawer toggles', () => {
    it('openDrawer without payload only sets drawerOpen=true', () => {
      const store = createStore();
      store.dispatch(openDrawer(undefined));
      const s = getChatBar(store);
      expect(s.drawerOpen).toBe(true);
      expect(s.activePanel).toBe('chat'); // unchanged
    });

    it('openDrawer with payload sets activePanel', () => {
      const store = createStore();
      store.dispatch(openDrawer('agent'));
      const s = getChatBar(store);
      expect(s.drawerOpen).toBe(true);
      expect(s.activePanel).toBe('agent');
    });

    it('closeDrawer sets drawerOpen=false', () => {
      const store = createStore();
      store.dispatch(openDrawer('chat'));
      store.dispatch(closeDrawer());
      expect(getChatBar(store).drawerOpen).toBe(false);
    });

    it('setActivePanel switches the active panel', () => {
      const store = createStore();
      store.dispatch(setActivePanel('niche'));
      expect(getChatBar(store).activePanel).toBe('niche');
    });

    it('setDrawerWidth accepts arbitrary stepless values within the clamp range', () => {
      const store = createStore();
      store.dispatch(setDrawerWidth(612));
      expect(getChatBar(store).drawerWidth).toBe(612);
      store.dispatch(setDrawerWidth(901));
      expect(getChatBar(store).drawerWidth).toBe(901);
    });

    it('setDrawerWidth clamps below 380 to 380', () => {
      const store = createStore();
      store.dispatch(setDrawerWidth(100));
      expect(getChatBar(store).drawerWidth).toBe(380);
    });

    it('setDrawerWidth clamps above 1400 to 1400', () => {
      const store = createStore();
      store.dispatch(setDrawerWidth(5000));
      expect(getChatBar(store).drawerWidth).toBe(1400);
    });

    it('toggleDrawerLayout flips between overlap and sideBySide', async () => {
      const { toggleDrawerLayout } = await import('@/store/chatBarSlice');
      const store = createStore();
      expect(getChatBar(store).drawerLayout).toBe('overlap');
      store.dispatch(toggleDrawerLayout());
      expect(getChatBar(store).drawerLayout).toBe('sideBySide');
      store.dispatch(toggleDrawerLayout());
      expect(getChatBar(store).drawerLayout).toBe('overlap');
    });

    it('setDrawerLayout sets the value directly', async () => {
      const { setDrawerLayout } = await import('@/store/chatBarSlice');
      const store = createStore();
      store.dispatch(setDrawerLayout('sideBySide'));
      expect(getChatBar(store).drawerLayout).toBe('sideBySide');
      store.dispatch(setDrawerLayout('overlap'));
      expect(getChatBar(store).drawerLayout).toBe('overlap');
    });
  });

  describe('session / agent / niche', () => {
    it('setActiveSession sets activeSessionId', () => {
      const store = createStore();
      store.dispatch(setActiveSession('sess-123'));
      expect(getChatBar(store).activeSessionId).toBe('sess-123');
      store.dispatch(setActiveSession(null));
      expect(getChatBar(store).activeSessionId).toBeNull();
    });

    it('setActiveAgentSessionId sets activeAgentSessionId', () => {
      const store = createStore();
      store.dispatch(setActiveAgentSessionId('agent-1'));
      expect(getChatBar(store).activeAgentSessionId).toBe('agent-1');
    });

    it('setInputChip stores niche_id and niche_name', () => {
      const store = createStore();
      store.dispatch(
        setInputChip({ niche_id: 'n1', niche_name: 'Camping Dad' }),
      );
      expect(getChatBar(store).inputChip).toEqual({
        niche_id: 'n1',
        niche_name: 'Camping Dad',
      });
    });

    it('setInputChip(null) clears the chip', () => {
      const store = createStore();
      store.dispatch(setInputChip({ niche_id: 'n1', niche_name: 'X' }));
      store.dispatch(setInputChip(null));
      expect(getChatBar(store).inputChip).toBeNull();
    });
  });

  describe('search settings', () => {
    it('setSearching toggles searching', () => {
      const store = createStore();
      store.dispatch(setSearching(true));
      expect(getChatBar(store).searching).toBe(true);
    });

    it('setSearchSources replaces sources array', () => {
      const store = createStore();
      store.dispatch(setSearchSources(['web', 'academic']));
      expect(getChatBar(store).searchSources).toEqual(['web', 'academic']);
    });

    it('setSelectedModel updates model', () => {
      const store = createStore();
      store.dispatch(setSelectedModel('claude-opus-4'));
      expect(getChatBar(store).selectedModel).toBe('claude-opus-4');
    });

    it('setModeOverride switches between chat/agent', () => {
      // PROJ-20 refactor: ModeOverride is now binary 'chat' | 'agent'.
      const store = createStore();
      store.dispatch(setModeOverride('agent'));
      expect(getChatBar(store).modeOverride).toBe('agent');
      store.dispatch(setModeOverride('chat'));
      expect(getChatBar(store).modeOverride).toBe('chat');
    });
  });

  describe('streaming reducers', () => {
    it('setStreamingAssistantMessage seeds id, content, sources, isStreaming=true', () => {
      const store = createStore();
      store.dispatch(
        setStreamingAssistantMessage({
          id: 'tmp-1',
          content: 'partial',
          sources: [],
        }),
      );
      const s = getChatBar(store).streamingAssistantMessage;
      expect(s.id).toBe('tmp-1');
      expect(s.content).toBe('partial');
      expect(s.isStreaming).toBe(true);
    });

    it('setStreamingAssistantMessage defaults content="" and sources=[] when omitted', () => {
      const store = createStore();
      store.dispatch(setStreamingAssistantMessage({ id: 'tmp-2' }));
      const s = getChatBar(store).streamingAssistantMessage;
      expect(s.content).toBe('');
      expect(s.sources).toEqual([]);
      expect(s.isStreaming).toBe(true);
    });

    it('appendStreamingChunk appends only when streaming is active', () => {
      const store = createStore();
      // Not streaming → should not append
      store.dispatch(appendStreamingChunk('ignored'));
      expect(getChatBar(store).streamingAssistantMessage.content).toBe('');
      // Now streaming
      store.dispatch(setStreamingAssistantMessage({ id: 'x', content: 'hello' }));
      store.dispatch(appendStreamingChunk(' world'));
      expect(getChatBar(store).streamingAssistantMessage.content).toBe('hello world');
    });

    it('appendStreamingSources replaces when sources empty, then concats', () => {
      const store = createStore();
      store.dispatch(setStreamingAssistantMessage({ id: 'x' }));
      const batch1 = [
        { title: 'A', url: 'https://a.com', snippet: 's' },
      ];
      const batch2 = [
        { title: 'B', url: 'https://b.com', snippet: 's' },
      ];
      store.dispatch(appendStreamingSources(batch1));
      expect(getChatBar(store).streamingAssistantMessage.sources).toEqual(batch1);
      // Second call concats
      store.dispatch(appendStreamingSources(batch2));
      expect(getChatBar(store).streamingAssistantMessage.sources).toHaveLength(2);
      expect(getChatBar(store).streamingAssistantMessage.sources[1].url).toBe(
        'https://b.com',
      );
    });

    it('appendStreamingSources is no-op when not streaming', () => {
      const store = createStore();
      const batch = [{ title: 'A', url: 'https://a.com', snippet: 's' }];
      store.dispatch(appendStreamingSources(batch));
      expect(getChatBar(store).streamingAssistantMessage.sources).toEqual([]);
    });

    it('setStreamingActive(false) flips isStreaming flag', () => {
      const store = createStore();
      store.dispatch(setStreamingAssistantMessage({ id: 'x' }));
      expect(getChatBar(store).streamingAssistantMessage.isStreaming).toBe(true);
      store.dispatch(setStreamingActive(false));
      expect(getChatBar(store).streamingAssistantMessage.isStreaming).toBe(false);
    });

    it('clearStreamingMessage resets to default', () => {
      const store = createStore();
      store.dispatch(
        setStreamingAssistantMessage({
          id: 'x',
          content: 'some',
          sources: [{ title: 'A', url: 'https://a.com', snippet: 's' }],
        }),
      );
      store.dispatch(clearStreamingMessage());
      expect(getChatBar(store).streamingAssistantMessage).toEqual({
        id: null,
        content: '',
        sources: [],
        isStreaming: false,
      });
    });
  });

  // PROJ-29 Phase 1H — ThinkingStrip + chunks + follow-ups reducers
  describe('PROJ-29 thinking + chunks + follow-ups reducers', () => {
    const mkStep = (stage: string, ts = 1000): ThinkingStep => ({
      stage,
      status: 'loading',
      ts,
    });

    it('pushStreamingStage appends a step', () => {
      const store = createStore();
      store.dispatch(pushStreamingStage(mkStep('retrieve_niche')));
      expect(getChatBar(store).streamingStages).toHaveLength(1);
      expect(getChatBar(store).streamingStages[0].stage).toBe('retrieve_niche');
    });

    it('pushStreamingStage caps streamingStages at 50 (FIFO)', () => {
      const store = createStore();
      for (let i = 0; i < 51; i += 1) {
        store.dispatch(pushStreamingStage(mkStep(`stage_${i}`, i)));
      }
      const stages = getChatBar(store).streamingStages;
      expect(stages).toHaveLength(50);
      // FIFO: oldest (stage_0) is evicted, newest (stage_50) is present.
      expect(stages[0].stage).toBe('stage_1');
      expect(stages[stages.length - 1].stage).toBe('stage_50');
    });

    it('markStageDone flips most recent loading row → done with durationMs', () => {
      const store = createStore();
      store.dispatch(pushStreamingStage(mkStep('retrieve_niche', 1000)));
      store.dispatch(markStageDone({ stage: 'retrieve_niche', ts: 2500 }));
      const row = getChatBar(store).streamingStages[0];
      expect(row.status).toBe('done');
      expect(row.durationMs).toBe(1500);
    });

    it('markStageWarning sets warning status + message', () => {
      const store = createStore();
      store.dispatch(pushStreamingStage(mkStep('web_search')));
      store.dispatch(
        markStageWarning({ stage: 'web_search', message: 'timed out' }),
      );
      const row = getChatBar(store).streamingStages[0];
      expect(row.status).toBe('warning');
      expect(row.message).toBe('timed out');
    });

    it('appendChunksUsed concats and caps at 200 (FIFO)', () => {
      const store = createStore();
      const batch = (start: number, len: number): ChunkUsed[] =>
        Array.from({ length: len }, (_, i) => ({
          index: start + i,
          content_subtype: 'notes' as const,
          text: `text ${start + i}`,
        }));
      store.dispatch(appendChunksUsed(batch(0, 150)));
      expect(getChatBar(store).chunksUsed).toHaveLength(150);
      store.dispatch(appendChunksUsed(batch(150, 60))); // 210 total → cap 200
      const chunks = getChatBar(store).chunksUsed;
      expect(chunks).toHaveLength(200);
      // Oldest evicted: first should be index 10, last 209.
      expect(chunks[0].index).toBe(10);
      expect(chunks[chunks.length - 1].index).toBe(209);
    });

    it('clearStreamingMessage resets thinking state but keeps followUps', () => {
      const store = createStore();
      store.dispatch(setStreamingAssistantMessage({ id: 'x' }));
      store.dispatch(pushStreamingStage(mkStep('retrieve_niche')));
      store.dispatch(
        appendChunksUsed([
          { index: 0, content_subtype: 'notes', text: 't' },
        ]),
      );
      store.dispatch(setFollowUps(['a', 'b', 'c']));
      store.dispatch(clearStreamingMessage());
      const s = getChatBar(store);
      expect(s.streamingStages).toEqual([]);
      expect(s.chunksUsed).toEqual([]);
      expect(s.streamStartedAt).toBeNull();
      // followUps intentionally preserved until the next user message.
      expect(s.followUps).toEqual(['a', 'b', 'c']);
    });

    it('setFollowUps caps at 3', () => {
      const store = createStore();
      store.dispatch(setFollowUps(['a', 'b', 'c', 'd', 'e']));
      expect(getChatBar(store).followUps).toEqual(['a', 'b', 'c']);
    });

    it('clearFollowUps empties the array', () => {
      const store = createStore();
      store.dispatch(setFollowUps(['a', 'b']));
      store.dispatch(clearFollowUps());
      expect(getChatBar(store).followUps).toEqual([]);
    });

    it('setStreamingAssistantMessage records streamStartedAt + clears prior steps/chunks', () => {
      const store = createStore();
      store.dispatch(pushStreamingStage(mkStep('old_stage')));
      store.dispatch(
        appendChunksUsed([
          { index: 0, content_subtype: 'notes', text: 'old' },
        ]),
      );
      store.dispatch(setStreamingAssistantMessage({ id: 'new' }));
      const s = getChatBar(store);
      expect(s.streamingStages).toEqual([]);
      expect(s.chunksUsed).toEqual([]);
      expect(typeof s.streamStartedAt).toBe('number');
    });
  });

  // FIX-dashboard-bug-report-and-polish Item 9 — search-depth knob.
  describe('searchMode (Item 9)', () => {
    const STORAGE_KEY = 'chat-search-mode-global';

    beforeEach(() => {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    });

    it('setSearchMode mutates state to "balanced"', () => {
      const store = createStore();
      store.dispatch(setSearchMode('balanced'));
      expect(getChatBar(store).searchMode).toBe('balanced');
    });

    it('setSearchMode mutates state to "quality"', () => {
      const store = createStore();
      store.dispatch(setSearchMode('quality'));
      expect(getChatBar(store).searchMode).toBe('quality');
    });

    it('setSearchMode writes the value to localStorage', () => {
      const store = createStore();
      store.dispatch(setSearchMode('balanced'));
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('balanced');
    });

    it('selectSearchMode returns the current searchMode', () => {
      const store = createStore();
      store.dispatch(setSearchMode('quality'));
      expect(selectSearchMode(store.getState())).toBe('quality');
    });

    it('falls back to "speed" when localStorage has an invalid value (EC-9-1)', async () => {
      // EC-9-1 — the slice's `readPersistedSearchMode` helper validates the
      // stored value against the SearchMode union before adopting it. We
      // assert that contract by reseeding localStorage with a bogus value
      // and reloading the slice module so its initialState helper re-runs.
      window.localStorage.setItem(STORAGE_KEY, 'turbo-mode-9000');
      const importer = vi.fn(async () => {
        // resetModules clears the import cache so the next dynamic import
        // re-evaluates the slice's module-scoped `readPersistedSearchMode`.
        const isolatedReducer = (await import('../chatBarSlice')).default;
        return configureStore({ reducer: { chatBar: isolatedReducer } });
      });
      // Reset the module registry between assertions so any prior tests'
      // module evaluation doesn't leak into this check.
      vi.resetModules();
      const isolatedStore = await importer();
      expect(isolatedStore.getState().chatBar.searchMode).toBe('speed');
    });
  });
});
