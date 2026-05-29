/**
 * FIX-chat-bugfixes-and-grouping Phase 7 — Vitest for `UngroupedSection`.
 *
 * The component depends on `@dnd-kit/core.useDroppable` + `@dnd-kit/sortable
 * SortableContext`. We stub both libraries so the component can mount without
 * a real `DndContext`, then assert the static structure (label, count badge,
 * absence of a kebab menu, rendered chat rows).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { ChatSession } from '@/types/search';

// ---- hoisted dnd-kit stubs ----
vi.mock('@dnd-kit/core', () => ({
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false, over: null }),
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

// ---- Now safe to import code under test ----
import UngroupedSection from '../UngroupedSection';

// ---- Fixtures ----
const makeSession = (overrides: Partial<ChatSession> = {}): ChatSession => ({
  id: 's1',
  title: 'Untitled chat',
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
  activeSessionId: null,
  onSelectSession: vi.fn(),
  onRequestDeleteSession: vi.fn(),
};

describe('UngroupedSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the i18n "No group" label and the session count', () => {
    const sessions = [
      makeSession({ id: 's1', title: 'Alpha' }),
      makeSession({ id: 's2', title: 'Beta' }),
    ];

    renderWithProviders(
      <UngroupedSection sessions={sessions} {...defaultProps} />,
    );

    // i18n "chat.groups.ungrouped" → "No group"
    expect(screen.getByText('No group')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders all chat rows passed via the sessions prop', () => {
    const sessions = [
      makeSession({ id: 's1', title: 'Alpha' }),
      makeSession({ id: 's2', title: 'Beta' }),
      makeSession({ id: 's3', title: 'Gamma' }),
    ];

    renderWithProviders(
      <UngroupedSection sessions={sessions} {...defaultProps} />,
    );

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
  });

  it('renders no kebab menu trigger on the header', () => {
    renderWithProviders(
      <UngroupedSection sessions={[]} {...defaultProps} />,
    );

    // The "Rename" / "Delete" affordances live behind a kebab in GroupSection
    // only. UngroupedSection must NOT expose any rename/delete affordance on
    // the section itself.
    expect(screen.queryByLabelText(/rename/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /more options/i }),
    ).not.toBeInTheDocument();
  });

  it('always renders (even with zero sessions) so the section is the first thing the user sees', () => {
    renderWithProviders(
      <UngroupedSection sessions={[]} {...defaultProps} />,
    );

    expect(screen.getByTestId('ungrouped-section')).toBeInTheDocument();
    expect(screen.getByText('No group')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
