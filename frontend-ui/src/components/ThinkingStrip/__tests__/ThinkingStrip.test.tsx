/**
 * PROJ-29 Phase 1H — ThinkingStrip component tests.
 *
 * Covers:
 *   - Streaming variant renders one StepRow per Redux step.
 *   - Persisted variant renders collapsed pill when persisted data is passed.
 *   - Click pill expands the ExpandedPanel.
 *   - `prefers-reduced-motion` swaps CircularProgress for static dot.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import chatBarReducer from '@/store/chatBarSlice';
import { renderWithProviders } from '@/utils/test-utils';
import ThinkingStrip from '..';
import type { ChunkUsed, ThinkingStep } from '@/types/chat-rag';

const renderStrip = (
  props: {
    isStreaming: boolean;
    persistedSteps?: ThinkingStep[];
    persistedChunksUsed?: ChunkUsed[];
    persistedDurationMs?: number;
  },
  state?: {
    streamingStages?: ThinkingStep[];
    chunksUsed?: ChunkUsed[];
    streamStartedAt?: number | null;
    isStreaming?: boolean;
  },
) =>
  renderWithProviders(<ThinkingStrip messageId="msg-1" {...props} />, {
    reducers: { chatBar: chatBarReducer },
    preloadedState: {
      chatBar: {
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
          isStreaming: state?.isStreaming ?? false,
        },
        recentChatsOverlayOpen: false,
        streamingStages: state?.streamingStages ?? [],
        chunksUsed: state?.chunksUsed ?? [],
        followUps: [],
        streamStartedAt: state?.streamStartedAt ?? null,
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

describe('<ThinkingStrip />', () => {
  beforeEach(() => {
    setMatchMedia(false); // reduced-motion OFF by default
  });

  it('streaming variant renders a StepRow per Redux step', () => {
    const steps: ThinkingStep[] = [
      { stage: 'retrieve_niche', status: 'loading', ts: 1000 },
      { stage: 'search_slogans', status: 'done', ts: 1100, durationMs: 500 },
      { stage: 'writing_answer', status: 'loading', ts: 1500 },
    ];
    renderStrip(
      { isStreaming: true },
      { streamingStages: steps, isStreaming: true, streamStartedAt: 1000 },
    );

    const active = screen.getByTestId('thinking-strip-active');
    expect(active.querySelectorAll('[data-stage]')).toHaveLength(3);
    expect(active.querySelector('[data-stage="retrieve_niche"]')).not.toBeNull();
    expect(active.querySelector('[data-stage="search_slogans"]')).not.toBeNull();
  });

  it('streaming variant with no steps renders nothing', () => {
    const { container } = renderStrip(
      { isStreaming: true },
      { streamingStages: [], isStreaming: true, streamStartedAt: 1000 },
    );
    expect(container.querySelector('[data-testid="thinking-strip-active"]')).toBeNull();
  });

  it('persisted variant renders collapsed pill', () => {
    const persistedSteps: ThinkingStep[] = [
      { stage: 'retrieve_niche', status: 'done', ts: 1000, durationMs: 800 },
    ];
    const persistedChunks: ChunkUsed[] = [
      { index: 1, content_subtype: 'slogan', text: 'A slogan example' },
    ];
    renderStrip({
      isStreaming: false,
      persistedSteps,
      persistedChunksUsed: persistedChunks,
      persistedDurationMs: 2300,
    });
    expect(screen.getByTestId('thinking-strip-persisted')).toBeTruthy();
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('click on collapsed pill toggles aria-expanded', () => {
    const persistedSteps: ThinkingStep[] = [
      { stage: 'retrieve_niche', status: 'done', ts: 1000, durationMs: 800 },
    ];
    renderStrip({
      isStreaming: false,
      persistedSteps,
      persistedChunksUsed: [],
      persistedDurationMs: 800,
    });
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('renders nothing when not streaming and no persisted data', () => {
    const { container } = renderStrip({ isStreaming: false });
    expect(container.querySelector('[data-testid^="thinking-strip"]')).toBeNull();
  });

  it('prefers-reduced-motion: replaces CircularProgress with a static dot', () => {
    setMatchMedia(true);
    const steps: ThinkingStep[] = [
      { stage: 'retrieve_niche', status: 'loading', ts: 1000 },
    ];
    renderStrip(
      { isStreaming: true },
      { streamingStages: steps, isStreaming: true, streamStartedAt: 1000 },
    );
    // No CircularProgress (MUI sets role="progressbar")
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
