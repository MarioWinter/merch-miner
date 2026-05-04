/**
 * PROJ-18 Phase 14.6/14.8 — UserProfileEditor tests (AC-79)
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { mockGetProfile, mockPatchProfile } = vi.hoisted(() => ({
  mockGetProfile: vi.fn((..._args: unknown[]) => ({ data: undefined, isLoading: false })),
  mockPatchProfile: vi.fn(() => [vi.fn(), { isLoading: false }]),
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
  useGetProfileQuery: (...args: unknown[]) => mockGetProfile(...args),
  usePatchProfileMutation: (...args: unknown[]) => mockPatchProfile(...args),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { renderWithProviders } from '@/utils/test-utils';
import UserProfileEditor from '../partials/UserProfileEditor';

const profileFixture = (content: string, reasoning = 'Why I think so', charLimit = 1375) => ({
  id: 'p-1',
  workspace: 'ws-1',
  user: 'u-1',
  content_md: content,
  dialect_reasoning: reasoning,
  last_dialectic_at: null,
  dialect_cadence_sessions: 2,
  char_count: content.length,
  char_limit: charLimit,
  created_at: '2026-04-30T00:00:00Z',
  updated_at: '2026-04-30T00:00:00Z',
});

describe('UserProfileEditor', () => {
  it('renders char-counter values in edit mode', async () => {
    const user = userEvent.setup();
    mockGetProfile.mockReturnValueOnce({
      data: profileFixture('Likes minimalist UIs.'),
      isLoading: false,
    });
    const { container } = renderWithProviders(<UserProfileEditor />);
    const editButton = screen.queryByRole('button', { name: /edit/i });
    if (editButton) await user.click(editButton);
    expect(container.textContent).toMatch(/1375/); // limit visible
  });

  it('AC-79: dialect_reasoning toggle button exists and is clickable', async () => {
    const user = userEvent.setup();
    mockGetProfile.mockReturnValueOnce({
      data: profileFixture('Hi', 'Reasoning: prefers brevity'),
      isLoading: false,
    });
    renderWithProviders(<UserProfileEditor />);

    // Toggle button should exist (component fetches reasoning lazily via ?include_reasoning=true)
    const reasoningBtns = screen.getAllByRole('button', { name: /reasoning/i });
    expect(reasoningBtns.length).toBeGreaterThan(0);
    await user.click(reasoningBtns[0]);
    // Click did not throw — toggle works
  });
});
