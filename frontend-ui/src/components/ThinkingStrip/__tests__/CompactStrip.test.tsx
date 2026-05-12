/**
 * PROJ-29 Phase 1H — CompactStrip tests.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import chatBarReducer from '@/store/chatBarSlice';
import { renderWithProviders } from '@/utils/test-utils';
import CompactStrip from '../CompactStrip';
import type { ThinkingStep } from '@/types/chat-rag';

const renderCompact = (override: {
  isStreaming: boolean;
  streamingStages?: ThinkingStep[];
  streamStartedAt?: number | null;
}) =>
  renderWithProviders(<CompactStrip />, {
    reducers: { chatBar: chatBarReducer },
    preloadedState: {
      chatBar: {
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
        selectedModel: 'openai/gpt-4.1-mini',
        modeOverride: 'chat',
        streamingAssistantMessage: {
          id: null,
          content: '',
          sources: [],
          isStreaming: override.isStreaming,
        },
        recentChatsOverlayOpen: false,
        streamingStages: override.streamingStages ?? [],
        chunksUsed: [],
        followUps: [],
        streamStartedAt: override.streamStartedAt ?? null,
        flashCitation: null,
      },
    },
  });

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('<CompactStrip />', () => {
  beforeEach(() => {
    setMatchMedia(false);
  });

  it('renders when streaming is active', () => {
    renderCompact({
      isStreaming: true,
      streamingStages: [
        { stage: 'retrieve_niche', status: 'loading', ts: Date.now() },
      ],
      streamStartedAt: Date.now() - 1500,
    });
    expect(screen.getByTestId('thinking-compact-strip')).toBeTruthy();
  });

  it('renders nothing when streaming is inactive', () => {
    renderCompact({ isStreaming: false });
    expect(screen.queryByTestId('thinking-compact-strip')).toBeNull();
  });

  it('click dispatches openDrawer("chat")', () => {
    const { store } = renderCompact({
      isStreaming: true,
      streamingStages: [
        { stage: 'retrieve_niche', status: 'loading', ts: Date.now() },
      ],
      streamStartedAt: Date.now(),
    });
    const initial = store.getState() as { chatBar: { drawerOpen: boolean; activePanel: string } };
    expect(initial.chatBar.drawerOpen).toBe(false);

    fireEvent.click(screen.getByTestId('thinking-compact-strip'));

    const after = store.getState() as { chatBar: { drawerOpen: boolean; activePanel: string } };
    expect(after.chatBar.drawerOpen).toBe(true);
    expect(after.chatBar.activePanel).toBe('chat');
  });
});
