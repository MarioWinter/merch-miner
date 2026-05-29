/**
 * PROJ-20 Phase 3.1 — ChatInputBar scaffold tests
 *
 * Verifies the visual structure only:
 * - Renders in both `panel` and `floating` appearances
 * - Helper hint visible below the input
 * - All right-cluster buttons (sources/model/attachment/send) present
 * - Send button is disabled (placeholder state until 3.7)
 *
 * `useListNichesQuery` (added in Phase 3.3 for the @-mention picker) is
 * stubbed so we don't have to wire `nicheApi.middleware` into the test
 * store. We also have to stub every other RTK Query slice referenced by
 * the global store (`src/store/index.ts`) because that store is pulled in
 * transitively via `axiosBaseQuery → authService → store`. This matches
 * the established pattern in `views/ideas/tests/IdeaCard.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { fa } = vi.hoisted(() => ({
  fa: (n: string) => ({
    reducerPath: n,
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: { resetApiState: () => ({ type: 'noop' }) },
  }),
}));

vi.mock('@/store/nicheSlice', () => ({
  nicheApi: fa('nicheApi'),
  useListNichesQuery: () => ({
    data: { count: 0, results: [] },
    isLoading: false,
  }),
  // PROJ-20 Phase 3.4: ChatInputBar now consumes useGetNicheQuery via
  // useNicheChipSync. With no active niche in the test store, the query
  // is skipped — return an empty no-op shape.
  useGetNicheQuery: () => ({
    data: undefined,
    isError: false,
    isLoading: false,
  }),
}));
vi.mock('@/store/ideaSlice', () => ({ ideaApi: fa('ideaApi') }));
vi.mock('@/store/researchSlice', () => ({ researchApi: fa('researchApi') }));
vi.mock('@/store/designSlice', () => ({ designApi: fa('designApi') }));
vi.mock('@/store/keywordSlice', () => ({ keywordApi: fa('keywordApi') }));
vi.mock('@/store/publishSlice', () => ({ publishApi: fa('publishApi') }));
vi.mock('@/store/dashboardSlice', () => ({ dashboardApi: fa('dashboardApi') }));
vi.mock('@/store/kanbanSlice', () => ({ kanbanApi: fa('kanbanApi') }));
vi.mock('@/store/notificationSlice', () => ({ notificationApi: fa('notificationApi') }));
// Phase 3.6 added `ModePopoverButton`, which calls `useSearchHealth` →
// `useHealthCheckQuery`. The hook only reads `data?.vane === 'online'`, so a
// stub returning `undefined` data exercises the offline branch (acceptable
// for these scaffold tests). Without this export the component crashes on
// mount and every test in this file fails.
vi.mock('@/store/searchSlice', () => ({
  searchApi: fa('searchApi'),
  useHealthCheckQuery: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
  }),
}));
vi.mock('@/store/agentSlice', () => ({ agentApi: fa('agentApi') }));
vi.mock('@/store/collectedProductsSlice', () => ({
  collectedProductsApi: fa('collectedProductsApi'),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { renderWithProviders } from '@/utils/test-utils';
import chatBarReducer, { setStreamingAssistantMessage } from '@/store/chatBarSlice';
import attachmentsReducer from '@/store/attachmentsSlice';
import ChatInputBar from '../index';

// PROJ-20 Phase 3.4: ChatInputBar now reads `s.chatBar.inputChip` and
// dispatches setInputChip via the new useNicheChipSync wiring. Inject the
// chatBar reducer into every render.
// Phase 7: also include the attachments slice for AttachmentBar/Button.
const reducers = { chatBar: chatBarReducer, attachments: attachmentsReducer };

describe('ChatInputBar (Phase 3.1 scaffold)', () => {
  it('renders without crashing in panel appearance', () => {
    renderWithProviders(<ChatInputBar appearance="panel" />, { reducers });
    const shell = screen.getByTestId('chat-input-bar');
    expect(shell).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-editable')).toBeInTheDocument();
  });

  it('renders without crashing in floating appearance', () => {
    renderWithProviders(<ChatInputBar appearance="floating" />, { reducers });
    expect(screen.getByTestId('chat-input-bar')).toBeInTheDocument();
  });

  it('renders the helper hint below the input', () => {
    renderWithProviders(<ChatInputBar appearance="panel" />, { reducers });
    const helper = screen.getByTestId('chat-input-helper-hint');
    expect(helper).toBeInTheDocument();
    expect(helper.textContent ?? '').toMatch(/Shift\+Enter/);
  });

  it('renders the right-cluster buttons (sources button hidden while web is the only source)', () => {
    renderWithProviders(<ChatInputBar appearance="panel" />, { reducers });
    // PROJ-29 Phase 1J follow-up: Sources popover hides itself when only
    // `web` is exposed (Academic + Discussions removed from UI). Add the
    // sources-button assertion back when we wire Reddit OAuth + re-enable
    // the `discussions` entry in SourcesPopoverButton.SOURCES.
    expect(screen.queryByTestId('chat-input-sources-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('chat-input-model-button')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-attachment-button')).toBeInTheDocument();
    expect(screen.getByTestId('chat-input-send-button')).toBeInTheDocument();
  });

  it('renders the mode button on the left cluster', () => {
    renderWithProviders(<ChatInputBar appearance="panel" />, { reducers });
    expect(screen.getByTestId('chat-input-mode-button')).toBeInTheDocument();
  });

  it('renders the send button as disabled (placeholder state)', () => {
    renderWithProviders(<ChatInputBar appearance="panel" />, { reducers });
    const sendBtn = screen.getByTestId('chat-input-send-button');
    expect(sendBtn).toBeDisabled();
  });

  it('mounts the streaming glow + flips ShellInner data-streaming while a stream is in flight (Item 7.5)', () => {
    const initial = chatBarReducer(undefined, { type: '@@INIT' });
    const streaming = chatBarReducer(
      initial,
      setStreamingAssistantMessage({
        id: 'streaming',
        sources: [],
        content: '',
      }),
    );
    renderWithProviders(<ChatInputBar appearance="panel" />, {
      reducers,
      preloadedState: { chatBar: streaming },
    });
    expect(screen.getByTestId('chat-input-streaming-glow')).toBeInTheDocument();
    const bar = screen.getByTestId('chat-input-bar');
    expect(bar.querySelector('[data-streaming="true"]')).not.toBeNull();
  });

  it('omits the streaming glow when no stream is in flight', () => {
    renderWithProviders(<ChatInputBar appearance="panel" />, { reducers });
    expect(screen.queryByTestId('chat-input-streaming-glow')).toBeNull();
  });
});
