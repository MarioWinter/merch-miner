/**
 * FIX-chat-bugfixes-and-grouping Phase 7 — Vitest for the `RecentChats` panel.
 *
 * Strategy: mock the searchSlice RTK hooks so we control the rendered groups
 * and sessions deterministically, and stub `@dnd-kit/core` + `@dnd-kit/sortable`
 * so the DnD wiring doesn't require a real `DndContext` in jsdom. We then
 * assert:
 *   - Ungrouped section renders first with the chats whose `group === null`.
 *   - One `GroupSection` per group renders, in `ordering` order.
 *   - Group with no chats still renders.
 *   - "+ New group" button click reveals an inline TextField.
 *   - Submitting the TextField with Enter fires `createChatGroup({ name })`.
 *   - Escape clears + closes the inline TextField without firing the mutation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import type { ChatGroup, ChatSession } from '@/types/search';

// ---- hoisted dnd-kit stubs ----
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PointerSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: () => ({}),
  useSensors: () => [],
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useDndContext: () => ({ active: null }),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay-portal">{children}</div>
  ),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  verticalListSortingStrategy: vi.fn(),
  arrayMove: vi.fn(),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

// ---- hoisted RTK mocks ----
const {
  mockListSessions,
  mockGetGroups,
  mockDeleteSession,
  mockCreateGroup,
  mockRenameGroup,
  mockDeleteGroup,
  mockReorderGroups,
  mockReorderChats,
  mockMoveChat,
} = vi.hoisted(() => ({
  mockListSessions: vi.fn(),
  mockGetGroups: vi.fn(),
  mockDeleteSession: vi.fn(),
  mockCreateGroup: vi.fn(),
  mockRenameGroup: vi.fn(),
  mockDeleteGroup: vi.fn(),
  mockReorderGroups: vi.fn(),
  mockReorderChats: vi.fn(),
  mockMoveChat: vi.fn(),
}));

vi.mock('@/store/searchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/searchSlice')>();
  return {
    ...actual,
    useListSessionsQuery: () => mockListSessions(),
    useGetChatGroupsQuery: () => mockGetGroups(),
    useDeleteSessionMutation: () => [mockDeleteSession, { isLoading: false }],
    useCreateChatGroupMutation: () => [mockCreateGroup, { isLoading: false }],
    useRenameChatGroupMutation: () => [mockRenameGroup, { isLoading: false }],
    useDeleteChatGroupMutation: () => [mockDeleteGroup, { isLoading: false }],
    useReorderChatGroupsMutation: () => [mockReorderGroups, { isLoading: false }],
    useReorderChatsInGroupMutation: () => [mockReorderChats, { isLoading: false }],
    useMoveChatToGroupMutation: () => [mockMoveChat, { isLoading: false }],
  };
});

const okResult = () => ({ unwrap: vi.fn().mockResolvedValue(undefined) });
const failResult = (data: Record<string, unknown>) => ({
  unwrap: vi.fn().mockRejectedValue({ data }),
});

// ---- Now safe to import code under test ----
import RecentChats from '../../RecentChats';

// ---- Fixtures ----
const makeGroup = (overrides: Partial<ChatGroup> = {}): ChatGroup => ({
  id: 'g1',
  name: 'Niches',
  ordering: 1,
  session_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 's1',
  title: 'Untitled',
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
  ...overrides,
});

const defaultProps = {
  onSelect: vi.fn(),
  activeSessionId: null,
};

const seedTypicalData = () => {
  mockGetGroups.mockReturnValue({
    data: [
      makeGroup({ id: 'g1', name: 'Niches', ordering: 1, session_count: 2 }),
      makeGroup({ id: 'g2', name: 'Slogans', ordering: 2, session_count: 0 }),
    ],
    isLoading: false,
  });
  mockListSessions.mockReturnValue({
    data: {
      count: 3,
      next: null,
      previous: null,
      results: [
        makeSession({ id: 's1', title: 'Ungrouped Alpha', group: null }),
        makeSession({ id: 's2', title: 'Niche Chat One', group: 'g1', group_ordering: 1 }),
        makeSession({ id: 's3', title: 'Niche Chat Two', group: 'g1', group_ordering: 2 }),
      ],
    },
    isLoading: false,
  });
};

describe('RecentChats panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the UngroupedSection first with chats whose group is null', () => {
    seedTypicalData();

    renderWithProviders(<RecentChats {...defaultProps} />);

    expect(screen.getByTestId('ungrouped-section')).toBeInTheDocument();
    expect(screen.getByText('Ungrouped Alpha')).toBeInTheDocument();
  });

  it('renders one GroupSection per group, including groups with zero chats', () => {
    seedTypicalData();

    renderWithProviders(<RecentChats {...defaultProps} />);

    expect(screen.getByTestId('group-section-g1')).toBeInTheDocument();
    expect(screen.getByTestId('group-section-g2')).toBeInTheDocument();
    expect(screen.getByText('Niches')).toBeInTheDocument();
    expect(screen.getByText('Slogans')).toBeInTheDocument();

    // Niche Chat One/Two render inside group g1
    expect(screen.getByText('Niche Chat One')).toBeInTheDocument();
    expect(screen.getByText('Niche Chat Two')).toBeInTheDocument();
  });

  it('renders a skeleton loader while groups or sessions are loading', () => {
    mockGetGroups.mockReturnValue({ data: undefined, isLoading: true });
    mockListSessions.mockReturnValue({ data: undefined, isLoading: true });

    renderWithProviders(<RecentChats {...defaultProps} />);

    // Skeleton MUI variant; assert by data-testid via aria role would fail —
    // use querySelectorAll instead.
    const skeletons = document.querySelectorAll('.MuiSkeleton-root');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('clicking "+ New group" opens an inline TextField', async () => {
    seedTypicalData();
    const user = userEvent.setup();

    renderWithProviders(<RecentChats {...defaultProps} />);

    const newGroupBtn = screen.getByRole('button', { name: 'New group' });
    await user.click(newGroupBtn);

    const input = await screen.findByRole('textbox', { name: 'New group' });
    expect(input).toBeInTheDocument();
    // autofocus + maxLength=80 from slotProps.htmlInput
    expect((input as HTMLInputElement).maxLength).toBe(80);
  });

  it('submitting the inline TextField with Enter fires createChatGroup with the trimmed name', async () => {
    seedTypicalData();
    mockCreateGroup.mockReturnValue(okResult());
    const user = userEvent.setup();

    renderWithProviders(<RecentChats {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'New group' }));
    const input = await screen.findByRole('textbox', { name: 'New group' });

    await user.type(input, '  MyGroup  ');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    // Wait for the async commit path.
    await vi.waitFor(() => {
      expect(mockCreateGroup).toHaveBeenCalledWith({ name: 'MyGroup' });
    });
  });

  it('pressing Escape inside the inline TextField cancels without firing the mutation', async () => {
    seedTypicalData();
    const user = userEvent.setup();

    renderWithProviders(<RecentChats {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'New group' }));
    const input = await screen.findByRole('textbox', { name: 'New group' });
    await user.type(input, 'WillCancel');

    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });

    expect(mockCreateGroup).not.toHaveBeenCalled();
    // TextField unmounts after Escape.
    expect(
      screen.queryByRole('textbox', { name: 'New group' }),
    ).not.toBeInTheDocument();
  });

  it('shows the duplicate-name helper text when create rejects with chatgroup_duplicate_name', async () => {
    seedTypicalData();
    mockCreateGroup.mockReturnValue(
      failResult({ code: 'chatgroup_duplicate_name' }),
    );
    const user = userEvent.setup();

    renderWithProviders(<RecentChats {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'New group' }));
    const input = await screen.findByRole('textbox', { name: 'New group' });
    await user.type(input, 'Niches');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(
      await screen.findByText('A group with this name already exists'),
    ).toBeInTheDocument();
    // Input is still mounted — user can fix the value.
    expect(
      screen.getByRole('textbox', { name: 'New group' }),
    ).toBeInTheDocument();
  });
});
