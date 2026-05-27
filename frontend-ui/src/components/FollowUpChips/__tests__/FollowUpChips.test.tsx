/**
 * PROJ-29 Phase 1H-2 — FollowUpChips tests.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import chatBarReducer from '@/store/chatBarSlice';
import FollowUpChips from '../index';

const baseChatBar = {
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
  streamingAssistantMessage: { id: null, content: '', sources: [], isStreaming: false },
  recentChatsOverlayOpen: false,
  streamingStages: [],
  chunksUsed: [],
  streamStartedAt: null,
  flashCitation: null,
  streamingSloganPayload: null,
  completedSloganPayload: null,
};

const renderWithChips = (followUps: string[]) =>
  renderWithProviders(<FollowUpChips onSelect={vi.fn()} />, {
    reducers: { chatBar: chatBarReducer },
    preloadedState: { chatBar: { ...baseChatBar, followUps } },
  });

describe('<FollowUpChips />', () => {
  it('renders nothing when fewer than 3 chips (EC-20 graceful degradation)', () => {
    const { container } = renderWithChips(['only one', 'two']);
    expect(container.firstChild).toBeNull();
  });

  it('renders 3 chips when 3 follow-ups are present', () => {
    renderWithChips(['What styles trend?', 'How to source BSR?', 'Generate 5 more puns']);
    expect(screen.getByText('What styles trend?')).toBeInTheDocument();
    expect(screen.getByText('How to source BSR?')).toBeInTheDocument();
    expect(screen.getByText('Generate 5 more puns')).toBeInTheDocument();
  });

  it('click chip invokes onSelect with chip label', () => {
    const onSelect = vi.fn();
    renderWithProviders(<FollowUpChips onSelect={onSelect} />, {
      reducers: { chatBar: chatBarReducer },
      preloadedState: {
        chatBar: { ...baseChatBar, followUps: ['Alpha', 'Beta', 'Gamma'] },
      },
    });
    fireEvent.click(screen.getByText('Beta'));
    expect(onSelect).toHaveBeenCalledWith('Beta');
  });
});
