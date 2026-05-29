/**
 * FIX-chat-bugfixes-and-grouping Phase 7 — Vitest for `useChatGroupDnD`.
 *
 * Strategy: the hook is pure logic over dnd-kit `DragEndEvent` shapes — no DOM
 * required. We mock the three RTK Query mutation hooks the hook depends on
 * (`useReorderChatGroupsMutation`, `useReorderChatsInGroupMutation`,
 * `useMoveChatToGroupMutation`) so we can assert exact call args per branch.
 *
 * Three branches covered:
 *   1. group ↔ group → `reorderChatGroups({ ordered_ids })`.
 *   2. chat ↔ chat in same container → `reorderChatsInGroup({ groupId, ordered_ids })`.
 *   3. chat ↔ different container → `moveChatToGroup({ sessionId, groupId })`.
 *
 * Plus error-path branch: a rejecting mutation surfaces a notistack snackbar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { DragEndEvent } from '@dnd-kit/core';

// ---- hoisted mocks ----
const {
  mockReorderGroups,
  mockReorderChats,
  mockMoveChat,
  mockEnqueueSnackbar,
} = vi.hoisted(() => ({
  mockReorderGroups: vi.fn(),
  mockReorderChats: vi.fn(),
  mockMoveChat: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
}));

vi.mock('@/store/searchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/searchSlice')>();
  return {
    ...actual,
    useReorderChatGroupsMutation: () => [mockReorderGroups, { isLoading: false }],
    useReorderChatsInGroupMutation: () => [mockReorderChats, { isLoading: false }],
    useMoveChatToGroupMutation: () => [mockMoveChat, { isLoading: false }],
  };
});

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueueSnackbar }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Resolved-unwrap helper — the hook calls `.unwrap()` on every mutation result.
const okResult = () => ({ unwrap: vi.fn().mockResolvedValue(undefined) });
const failResult = () => ({
  unwrap: vi.fn().mockRejectedValue(new Error('boom')),
});

// ---- Now import code under test ----
import { useChatGroupDnD } from '../hooks/useChatGroupDnD';
import type { ChatGroup, ChatSession } from '@/types/search';

// ---- Fixtures ----
const makeGroup = (overrides: Partial<ChatGroup> = {}): ChatGroup => ({
  id: 'g1',
  name: 'Group One',
  ordering: 1,
  session_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 's1',
  title: 'Session One',
  is_shared: false,
  niche_context_id: null,
  niche_context_name: null,
  message_count: 1,
  shared_by: null,
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  group: null,
  group_ordering: 1,
  ...overrides,
});

/** Build a minimal `DragEndEvent` — only the fields the hook reads. */
const buildEvent = (
  activeId: string,
  activeData: Record<string, unknown>,
  overId: string,
  overData: Record<string, unknown>,
): DragEndEvent =>
  ({
    active: {
      id: activeId,
      data: { current: activeData },
    },
    over: {
      id: overId,
      data: { current: overData },
    },
    collisions: null,
    delta: { x: 0, y: 0 },
    activatorEvent: new Event('pointerdown'),
  }) as unknown as DragEndEvent;

describe('useChatGroupDnD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('group → group drop dispatches reorderChatGroups with the new ordered ids', async () => {
    mockReorderGroups.mockReturnValue(okResult());
    const groups = [
      makeGroup({ id: 'g1', ordering: 1 }),
      makeGroup({ id: 'g2', ordering: 2 }),
      makeGroup({ id: 'g3', ordering: 3 }),
    ];

    const { result } = renderHook(() =>
      useChatGroupDnD({ groups, sessions: [] }),
    );

    const event = buildEvent(
      'g1',
      { type: 'group', containerId: null, groupOrderedIds: ['g1', 'g2', 'g3'] },
      'g3',
      { type: 'group', containerId: null, groupOrderedIds: ['g1', 'g2', 'g3'] },
    );

    await act(async () => {
      await result.current.handleDragEnd(event);
    });

    expect(mockReorderGroups).toHaveBeenCalledTimes(1);
    expect(mockReorderGroups).toHaveBeenCalledWith({
      ordered_ids: ['g2', 'g3', 'g1'],
    });
    expect(mockReorderChats).not.toHaveBeenCalled();
    expect(mockMoveChat).not.toHaveBeenCalled();
  });

  it('chat ↔ chat same container dispatches reorderChatsInGroup with the new order', async () => {
    mockReorderChats.mockReturnValue(okResult());
    const sessions = [
      makeSession({ id: 's1', group: 'g1', group_ordering: 1 }),
      makeSession({ id: 's2', group: 'g1', group_ordering: 2 }),
      makeSession({ id: 's3', group: 'g1', group_ordering: 3 }),
    ];

    const { result } = renderHook(() =>
      useChatGroupDnD({ groups: [], sessions }),
    );

    const event = buildEvent(
      's1',
      {
        type: 'chat',
        containerId: 'g1',
        chatOrderedIdsInContainer: ['s1', 's2', 's3'],
      },
      's3',
      {
        type: 'chat',
        containerId: 'g1',
        chatOrderedIdsInContainer: ['s1', 's2', 's3'],
      },
    );

    await act(async () => {
      await result.current.handleDragEnd(event);
    });

    expect(mockReorderChats).toHaveBeenCalledTimes(1);
    expect(mockReorderChats).toHaveBeenCalledWith({
      groupId: 'g1',
      ordered_ids: ['s2', 's3', 's1'],
    });
    expect(mockMoveChat).not.toHaveBeenCalled();
    expect(mockReorderGroups).not.toHaveBeenCalled();
  });

  it('chat dragged into a different group dispatches moveChatToGroup', async () => {
    mockMoveChat.mockReturnValue(okResult());

    const { result } = renderHook(() =>
      useChatGroupDnD({ groups: [], sessions: [] }),
    );

    const event = buildEvent(
      's1',
      {
        type: 'chat',
        containerId: 'g1',
        chatOrderedIdsInContainer: ['s1'],
      },
      's9',
      {
        type: 'chat',
        containerId: 'g2',
        chatOrderedIdsInContainer: ['s9'],
      },
    );

    await act(async () => {
      await result.current.handleDragEnd(event);
    });

    expect(mockMoveChat).toHaveBeenCalledTimes(1);
    expect(mockMoveChat).toHaveBeenCalledWith({
      sessionId: 's1',
      groupId: 'g2',
    });
    expect(mockReorderChats).not.toHaveBeenCalled();
    expect(mockReorderGroups).not.toHaveBeenCalled();
  });

  it('chat dropped on a group container (not a chat row) appends via moveChatToGroup', async () => {
    mockMoveChat.mockReturnValue(okResult());

    const { result } = renderHook(() =>
      useChatGroupDnD({ groups: [], sessions: [] }),
    );

    // Drop target's data has type='chat' (the section's droppable) with
    // containerId pointing at the destination group. No
    // `chatOrderedIdsInContainer`, simulating an empty section drop.
    const event = buildEvent(
      's1',
      { type: 'chat', containerId: null, chatOrderedIdsInContainer: ['s1'] },
      'group-droppable-g2',
      { type: 'chat', containerId: 'g2' },
    );

    await act(async () => {
      await result.current.handleDragEnd(event);
    });

    expect(mockMoveChat).toHaveBeenCalledWith({
      sessionId: 's1',
      groupId: 'g2',
    });
  });

  it('returns early when active.id === over.id (no-op drop)', async () => {
    const { result } = renderHook(() =>
      useChatGroupDnD({ groups: [], sessions: [] }),
    );

    const event = buildEvent(
      'g1',
      { type: 'group', containerId: null },
      'g1',
      { type: 'group', containerId: null },
    );

    await act(async () => {
      await result.current.handleDragEnd(event);
    });

    expect(mockReorderGroups).not.toHaveBeenCalled();
    expect(mockReorderChats).not.toHaveBeenCalled();
    expect(mockMoveChat).not.toHaveBeenCalled();
  });

  it('mutation rejection surfaces a notistack error snackbar', async () => {
    mockReorderGroups.mockReturnValue(failResult());

    const groups = [
      makeGroup({ id: 'g1', ordering: 1 }),
      makeGroup({ id: 'g2', ordering: 2 }),
    ];

    const { result } = renderHook(() =>
      useChatGroupDnD({ groups, sessions: [] }),
    );

    const event = buildEvent(
      'g1',
      { type: 'group', containerId: null, groupOrderedIds: ['g1', 'g2'] },
      'g2',
      { type: 'group', containerId: null, groupOrderedIds: ['g1', 'g2'] },
    );

    await act(async () => {
      await result.current.handleDragEnd(event);
    });

    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
    const [, opts] = mockEnqueueSnackbar.mock.calls[0];
    expect((opts as { variant: string }).variant).toBe('error');
  });

  it('handleDragStart sets activeKind from the dragged item data', () => {
    const { result } = renderHook(() =>
      useChatGroupDnD({ groups: [], sessions: [] }),
    );

    act(() => {
      result.current.handleDragStart({
        active: { id: 'g1', data: { current: { type: 'group' } } },
      } as never);
    });

    expect(result.current.activeKind).toBe('group');
    expect(result.current.activeId).toBe('g1');

    act(() => {
      result.current.handleDragCancel();
    });

    expect(result.current.activeKind).toBe(null);
    expect(result.current.activeId).toBe(null);
  });
});
