/**
 * FIX-chat-bugfixes-and-grouping Phase 7 — Vitest for `ChatDragOverlay`.
 *
 * The overlay reads `useDndContext().active` to decide what ghost to render.
 * We selectively mock `@dnd-kit/core` so the test controls the active drag
 * payload deterministically; `DragOverlay` is stubbed to a transparent
 * pass-through so its `body` child renders into the testing DOM normally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { ChatGroup, ChatSession } from '@/types/search';

// ---- hoisted mocks ----
const { mockUseDndContext } = vi.hoisted(() => ({
  mockUseDndContext: vi.fn<() => { active: null | { id: string; data: { current: Record<string, unknown> } } }>(),
}));

vi.mock('@dnd-kit/core', () => ({
  useDndContext: () => mockUseDndContext(),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay-portal">{children}</div>
  ),
}));

// ---- Now safe to import code under test ----
import ChatDragOverlay from '../ChatDragOverlay';

// ---- Fixtures ----
const sessionA: ChatSession = {
  id: 's1',
  title: 'My Brilliant Chat',
  is_shared: false,
  niche_context_id: null,
  niche_context_name: null,
  message_count: 0,
  shared_by: null,
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  group: null,
  group_ordering: 1,
};

const groupA: ChatGroup = {
  id: 'g1',
  name: 'Niches',
  ordering: 1,
  session_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('ChatDragOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no ghost body when there is no active drag', () => {
    mockUseDndContext.mockReturnValue({ active: null });

    renderWithProviders(
      <ChatDragOverlay sessions={[sessionA]} groups={[groupA]} />,
    );

    expect(screen.getByTestId('drag-overlay-portal')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-drag-overlay-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-drag-overlay-group')).not.toBeInTheDocument();
  });

  it('renders the chat ghost with the session title when a chat drag is active', () => {
    mockUseDndContext.mockReturnValue({
      active: {
        id: 's1',
        data: { current: { type: 'chat', containerId: null } },
      },
    });

    renderWithProviders(
      <ChatDragOverlay sessions={[sessionA]} groups={[groupA]} />,
    );

    const ghost = screen.getByTestId('chat-drag-overlay-chat');
    expect(ghost).toBeInTheDocument();
    expect(ghost).toHaveTextContent('My Brilliant Chat');
    expect(screen.queryByTestId('chat-drag-overlay-group')).not.toBeInTheDocument();
  });

  it('renders the group ghost with the group name when a group drag is active', () => {
    mockUseDndContext.mockReturnValue({
      active: {
        id: 'g1',
        data: { current: { type: 'group', containerId: null } },
      },
    });

    renderWithProviders(
      <ChatDragOverlay sessions={[sessionA]} groups={[groupA]} />,
    );

    const ghost = screen.getByTestId('chat-drag-overlay-group');
    expect(ghost).toBeInTheDocument();
    expect(ghost).toHaveTextContent('Niches');
    expect(screen.queryByTestId('chat-drag-overlay-chat')).not.toBeInTheDocument();
  });

  it('renders no ghost body when the active id matches no known session or group', () => {
    mockUseDndContext.mockReturnValue({
      active: {
        id: 'unknown',
        data: { current: { type: 'chat', containerId: null } },
      },
    });

    renderWithProviders(
      <ChatDragOverlay sessions={[sessionA]} groups={[groupA]} />,
    );

    expect(screen.getByTestId('drag-overlay-portal')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-drag-overlay-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-drag-overlay-group')).not.toBeInTheDocument();
  });
});
