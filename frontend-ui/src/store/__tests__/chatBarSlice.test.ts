import { describe, it, expect } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import chatBarReducer, {
  expandBar,
  collapseBar,
  openDrawer,
  closeDrawer,
  setActivePanel,
  setDrawerWidth,
  setActiveSession,
  setActiveAgentSessionId,
  setNicheContext,
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
} from '../chatBarSlice';

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
    expect(s.barExpanded).toBe(false);
    expect(s.drawerOpen).toBe(false);
    expect(s.drawerWidth).toBe(480);
    expect(s.activePanel).toBe('chat');
    expect(s.activeSessionId).toBeNull();
    expect(s.activeAgentSessionId).toBeNull();
    expect(s.nicheContext).toBeNull();
    expect(s.searching).toBe(false);
    expect(s.searchMode).toBe('balanced');
    expect(s.searchSources).toEqual(['web']);
    expect(s.selectedModel).toBe('gpt-4.1-mini');
    expect(s.modeOverride).toBe('auto');
    expect(s.streamingAssistantMessage).toEqual({
      id: null,
      content: '',
      sources: [],
      isStreaming: false,
    });
  });

  describe('bar/drawer toggles', () => {
    it('expandBar / collapseBar flips barExpanded', () => {
      const store = createStore();
      store.dispatch(expandBar());
      expect(getChatBar(store).barExpanded).toBe(true);
      store.dispatch(collapseBar());
      expect(getChatBar(store).barExpanded).toBe(false);
    });

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
      store.dispatch(setActivePanel('history'));
      expect(getChatBar(store).activePanel).toBe('history');
    });

    it('setDrawerWidth snaps to allowed values', () => {
      const store = createStore();
      store.dispatch(setDrawerWidth(768));
      expect(getChatBar(store).drawerWidth).toBe(768);
      store.dispatch(setDrawerWidth(1200));
      expect(getChatBar(store).drawerWidth).toBe(1200);
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

    it('setNicheContext stores id and name', () => {
      const store = createStore();
      store.dispatch(setNicheContext({ id: 'n1', name: 'Camping Dad' }));
      expect(getChatBar(store).nicheContext).toEqual({
        id: 'n1',
        name: 'Camping Dad',
      });
    });

    it('setNicheContext(null) clears the context', () => {
      const store = createStore();
      store.dispatch(setNicheContext({ id: 'n1', name: 'X' }));
      store.dispatch(setNicheContext(null));
      expect(getChatBar(store).nicheContext).toBeNull();
    });
  });

  describe('search settings', () => {
    it('setSearching toggles searching', () => {
      const store = createStore();
      store.dispatch(setSearching(true));
      expect(getChatBar(store).searching).toBe(true);
    });

    it('setSearchMode updates mode', () => {
      const store = createStore();
      store.dispatch(setSearchMode('quality'));
      expect(getChatBar(store).searchMode).toBe('quality');
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

    it('setModeOverride switches between auto/web_search/agent', () => {
      const store = createStore();
      store.dispatch(setModeOverride('agent'));
      expect(getChatBar(store).modeOverride).toBe('agent');
      store.dispatch(setModeOverride('web_search'));
      expect(getChatBar(store).modeOverride).toBe('web_search');
      store.dispatch(setModeOverride('auto'));
      expect(getChatBar(store).modeOverride).toBe('auto');
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
});
