/**
 * PROJ-18 Phase 14.6/14.8 — MemoryEditor tests (AC-78)
 *
 * Focus: char-counter color-coding + save-disable when over limit + edit toggle.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { mockGetMemory, mockPatchMemory } = vi.hoisted(() => ({
  mockGetMemory: vi.fn((..._args: unknown[]) => ({ data: undefined, isLoading: false })),
  mockPatchMemory: vi.fn(() => [vi.fn(), { isLoading: false }]),
}));

vi.mock('@/store/agentSlice', () => ({
  agentApi: {
    reducerPath: 'agentApi',
    reducer: () => ({}),
    middleware: () => (x: any) => (a: any) => x(a),
    util: {
      resetApiState: () => ({ type: 'noop' }),
      invalidateTags: () => ({ type: 'noop' }),
    },
  },
  useGetMemoryQuery: (...args: unknown[]) => mockGetMemory(...args),
  usePatchMemoryMutation: (...args: unknown[]) => mockPatchMemory(...args),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { renderWithProviders } from '@/utils/test-utils';
import MemoryEditor from '../partials/MemoryEditor';

const memoryFixture = (content: string, charLimit = 2200) => ({
  id: 'mem-1',
  workspace: 'ws-1',
  content_md: content,
  last_consolidated_at: null,
  last_consolidated_session: null,
  char_count: content.length,
  char_limit: charLimit,
  created_at: '2026-04-30T00:00:00Z',
  updated_at: '2026-04-30T00:00:00Z',
});

describe('MemoryEditor', () => {
  it('renders char-counter with current/limit values in edit mode', async () => {
    const user = userEvent.setup();
    mockGetMemory.mockReturnValueOnce({
      data: memoryFixture('Hello world'),
      isLoading: false,
    });
    const { container } = renderWithProviders(<MemoryEditor />);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    // i18n key interpolates count/limit; assert both values present somewhere in the DOM
    expect(container.textContent).toMatch(/11/);
    expect(container.textContent).toMatch(/2200/);
  });

  it('AC-78: save button disabled when content over char_limit', async () => {
    const user = userEvent.setup();
    mockGetMemory.mockReturnValueOnce({
      data: memoryFixture('a'.repeat(100)),
      isLoading: false,
    });
    renderWithProviders(<MemoryEditor />);

    // Enter edit mode first
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Type content that exceeds 2200 chars
    const textarea = screen.getByTestId('memory-textarea');
    await user.click(textarea);
    // Use a single big paste-like operation
    await user.paste('x'.repeat(2201));

    // Save button should be disabled
    const saveBtn = screen.getByRole('button', { name: /save/i });
    expect(saveBtn).toBeDisabled();
  });

  it('AC-78: read-only by default, edit toggle reveals textarea editor', async () => {
    const user = userEvent.setup();
    mockGetMemory.mockReturnValueOnce({
      data: memoryFixture('Some memory content'),
      isLoading: false,
    });
    renderWithProviders(<MemoryEditor />);

    // Read-only: textarea should NOT be present yet
    expect(screen.queryByTestId('memory-textarea')).toBeNull();

    // Click edit
    await user.click(screen.getByRole('button', { name: /edit/i }));

    // Now textarea is present
    expect(screen.getByTestId('memory-textarea')).toBeInTheDocument();
  });
});
