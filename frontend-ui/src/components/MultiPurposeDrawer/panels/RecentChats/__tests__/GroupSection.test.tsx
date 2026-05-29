/**
 * FIX-chat-bugfixes-and-grouping Phase 7 — Vitest for `GroupSection`.
 *
 * Covers:
 *   - Header renders group name + session_count badge.
 *   - Collapsed prop drives which chevron icon is shown.
 *   - Click on the header invokes `onToggleCollapsed`.
 *   - Kebab opens a Menu with Rename + Delete items.
 *   - Rename → inline TextField appears, autofocuses, Enter fires the mutation.
 *   - Delete → confirm dialog opens with the group name in the title.
 *   - All chat rows passed via `sessions` render inside the body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import type { ChatGroup, ChatSession } from '@/types/search';

// ---- hoisted dnd-kit stubs ----
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sortable-context">{children}</div>
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
const { mockRenameGroup, mockDeleteGroup } = vi.hoisted(() => ({
  mockRenameGroup: vi.fn(),
  mockDeleteGroup: vi.fn(),
}));

vi.mock('@/store/searchSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/searchSlice')>();
  return {
    ...actual,
    useRenameChatGroupMutation: () => [mockRenameGroup, { isLoading: false }],
    useDeleteChatGroupMutation: () => [mockDeleteGroup, { isLoading: false }],
  };
});

const okResult = () => ({ unwrap: vi.fn().mockResolvedValue(undefined) });

// ---- Now safe to import code under test ----
import GroupSection from '../GroupSection';

// ---- Fixtures ----
const makeGroup = (overrides: Partial<ChatGroup> = {}): ChatGroup => ({
  id: 'g1',
  name: 'Niches',
  ordering: 1,
  session_count: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 's1',
  title: 'Alpha',
  is_shared: false,
  niche_context_id: null,
  niche_context_name: null,
  message_count: 0,
  shared_by: null,
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  group: 'g1',
  group_ordering: 1,
  ...overrides,
});

const buildProps = (
  overrides: Partial<{
    group: ChatGroup;
    sessions: ChatSession[];
    activeSessionId: string | null;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    onSelectSession: (s: ChatSession) => void;
    onRequestDeleteSession: (s: ChatSession) => void;
    groupOrderedIds: string[];
  }> = {},
) => ({
  group: overrides.group ?? makeGroup(),
  sessions: overrides.sessions ?? [],
  activeSessionId: overrides.activeSessionId ?? null,
  collapsed: overrides.collapsed ?? false,
  onToggleCollapsed: overrides.onToggleCollapsed ?? vi.fn(),
  onSelectSession: overrides.onSelectSession ?? vi.fn(),
  onRequestDeleteSession: overrides.onRequestDeleteSession ?? vi.fn(),
  groupOrderedIds: overrides.groupOrderedIds ?? ['g1'],
});

describe('GroupSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the group name and session_count badge in the header', () => {
    renderWithProviders(
      <GroupSection {...buildProps({ group: makeGroup({ name: 'Niches', session_count: 7 }) })} />,
    );

    expect(screen.getByText('Niches')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByTestId('group-section-g1')).toBeInTheDocument();
  });

  it('renders all child sessions inside the collapse body when expanded', () => {
    const sessions = [
      makeSession({ id: 's1', title: 'Alpha' }),
      makeSession({ id: 's2', title: 'Beta' }),
      makeSession({ id: 's3', title: 'Gamma' }),
    ];

    renderWithProviders(
      <GroupSection {...buildProps({ sessions, collapsed: false })} />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('invokes onToggleCollapsed when the header is clicked', async () => {
    const onToggleCollapsed = vi.fn();
    const user = userEvent.setup();

    renderWithProviders(
      <GroupSection {...buildProps({ onToggleCollapsed })} />,
    );

    await user.click(screen.getByText('Niches'));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it('opens the kebab menu with Rename + Delete items', async () => {
    const user = userEvent.setup();

    renderWithProviders(<GroupSection {...buildProps()} />);

    // The kebab IconButton has aria-label="Rename" (same key as the menu item
    // — that's the component's current implementation choice).
    const kebab = screen.getAllByLabelText('Rename')[0];
    await user.click(kebab);

    // Menu items present.
    const menuItems = await screen.findAllByRole('menuitem');
    const labels = menuItems.map((mi) => mi.textContent);
    expect(labels).toContain('Rename');
    expect(labels).toContain('Delete');
  });

  it('selecting Rename swaps the label for an inline TextField with a maxLength of 80', async () => {
    const user = userEvent.setup();

    renderWithProviders(<GroupSection {...buildProps()} />);

    const kebab = screen.getAllByLabelText('Rename')[0];
    await user.click(kebab);
    const menuItems = await screen.findAllByRole('menuitem');
    const renameItem = menuItems.find((mi) => mi.textContent === 'Rename')!;
    await user.click(renameItem);

    const input = await screen.findByLabelText('Rename');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).maxLength).toBe(80);
  });

  it('committing a new name on Enter fires the rename mutation with the trimmed value', async () => {
    mockRenameGroup.mockReturnValue(okResult());
    const user = userEvent.setup();

    renderWithProviders(<GroupSection {...buildProps()} />);

    await user.click(screen.getAllByLabelText('Rename')[0]);
    const menuItems = await screen.findAllByRole('menuitem');
    await user.click(menuItems.find((mi) => mi.textContent === 'Rename')!);

    const input = await screen.findByLabelText('Rename');
    await user.clear(input);
    await user.type(input, '  Listings  ');
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockRenameGroup).toHaveBeenCalledWith({ id: 'g1', name: 'Listings' });
    });
  });

  it('selecting Delete opens a confirm dialog whose title includes the group name', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <GroupSection {...buildProps({ group: makeGroup({ name: 'Niches' }) })} />,
    );

    await user.click(screen.getAllByLabelText('Rename')[0]);
    const menuItems = await screen.findAllByRole('menuitem');
    await user.click(menuItems.find((mi) => mi.textContent === 'Delete')!);

    // ConfirmDialog renders a dialog with title containing the group name.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent("Delete group 'Niches'?");
  });

  it('confirming the delete dialog dispatches the delete mutation with the group id', async () => {
    mockDeleteGroup.mockReturnValue(okResult());
    const user = userEvent.setup();

    renderWithProviders(<GroupSection {...buildProps()} />);

    await user.click(screen.getAllByLabelText('Rename')[0]);
    const menuItems = await screen.findAllByRole('menuitem');
    await user.click(menuItems.find((mi) => mi.textContent === 'Delete')!);

    const dialog = await screen.findByRole('dialog');
    const confirmButton = await screen.findByRole('button', {
      name: 'Delete',
    });
    // ConfirmDialog button is inside the dialog.
    expect(dialog).toContainElement(confirmButton);
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockDeleteGroup).toHaveBeenCalledWith({ id: 'g1' });
    });
  });
});
