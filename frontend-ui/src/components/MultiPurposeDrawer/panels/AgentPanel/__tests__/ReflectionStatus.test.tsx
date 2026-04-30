/**
 * PROJ-18 Phase 14.6/14.8 — ReflectionStatus tests (AC-80)
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* eslint-disable @typescript-eslint/no-explicit-any */
const { mockGetMemory, mockGetWorkspaceConfig, mockGetSessions } = vi.hoisted(() => ({
  mockGetMemory: vi.fn((..._args: unknown[]) => ({ data: undefined })),
  mockGetWorkspaceConfig: vi.fn((..._args: unknown[]) => ({ data: undefined })),
  mockGetSessions: vi.fn((..._args: unknown[]) => ({ data: undefined })),
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
  useGetWorkspaceConfigQuery: (...args: unknown[]) => mockGetWorkspaceConfig(...args),
  useListSessionsQuery: (...args: unknown[]) => mockGetSessions(...args),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { renderWithProviders } from '@/utils/test-utils';
import ReflectionStatus from '../partials/ReflectionStatus';

describe('ReflectionStatus', () => {
  it('AC-80: clicking the chip invokes onOpenMemory callback', async () => {
    const user = userEvent.setup();
    const onOpenMemory = vi.fn();
    mockGetMemory.mockReturnValueOnce({
      data: {
        id: 'm-1',
        workspace: 'ws-1',
        content_md: '',
        last_consolidated_at: '2026-04-29T12:00:00Z',
        last_consolidated_session: null,
        char_count: 0,
        char_limit: 2200,
        created_at: '2026-04-30T00:00:00Z',
        updated_at: '2026-04-30T00:00:00Z',
      },
    });
    mockGetWorkspaceConfig.mockReturnValueOnce({
      data: { reflection_cadence_sessions: 1 },
    });
    mockGetSessions.mockReturnValueOnce({ data: { count: 0, results: [] } });

    renderWithProviders(<ReflectionStatus onOpenMemory={onOpenMemory} />);

    // The chip should be clickable
    const chipButton = screen.getByRole('button', { name: /reflection|memory/i });
    await user.click(chipButton);
    expect(onOpenMemory).toHaveBeenCalled();
  });
});
