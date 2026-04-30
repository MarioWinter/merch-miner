/**
 * PROJ-18 Phase 10 — AgentHeader tests
 *
 * Focus: AC-43 visibility logic. Pause/Resume/Stop only visible when status
 * is `running` or `paused`.
 */
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ---- hoisted mocks ----
// Stub agentSlice so useGetConfigQuery (Phase 11 wiring for AC-55c) returns
// controlled data without requiring agentApi middleware in the test store.
// The agentApi stub mirrors the `fa()` factory used in
// `ChatInputBar/__tests__/index.test.tsx` so the global store
// (pulled in transitively via axiosBaseQuery → authService → store) can
// still call `.middleware` / `.reducer` without crashing.
/* eslint-disable @typescript-eslint/no-explicit-any */
const { mockUseGetConfigQuery } = vi.hoisted(() => ({
  mockUseGetConfigQuery: vi.fn(() => ({ data: undefined })),
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
  useGetConfigQuery: (...args: unknown[]) => mockUseGetConfigQuery(...args),
}));
/* eslint-enable @typescript-eslint/no-explicit-any */

import { renderWithProviders } from '@/utils/test-utils';
import AgentHeader from '../partials/AgentHeader';
import { buildSession } from './fixtures';
import type { SessionStatus } from '@/types/agent';

const baseProps = {
  onPause: vi.fn(),
  onResume: vi.fn(),
  onStop: vi.fn(),
  onShare: vi.fn(),
  onUnshare: vi.fn(),
  onSettings: vi.fn(),
  onClearNiche: vi.fn(),
  pausing: false,
  resuming: false,
  stopping: false,
  budgetPercent: 0,
};

describe('AgentHeader', () => {
  it('renders Pause button when status is running', () => {
    const session = buildSession({ status: 'running' });
    renderWithProviders(<AgentHeader {...baseProps} session={session} />);
    expect(screen.getByRole('button', { name: /pause workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop workflow/i })).toBeInTheDocument();
  });

  it('renders Resume button when status is paused', () => {
    const session = buildSession({ status: 'paused' });
    renderWithProviders(<AgentHeader {...baseProps} session={session} />);
    expect(screen.getByRole('button', { name: /resume workflow/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /stop workflow/i })).toBeInTheDocument();
  });

  it('AC-43: hides Pause/Resume/Stop when status is idle', () => {
    const session = buildSession({ status: 'idle' });
    renderWithProviders(<AgentHeader {...baseProps} session={session} />);
    expect(screen.queryByRole('button', { name: /pause workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /resume workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stop workflow/i })).toBeNull();
  });

  it.each<SessionStatus>(['completed', 'failed', 'cancelled'])(
    'AC-43: hides Pause/Resume/Stop when status is %s',
    (status) => {
      const session = buildSession({ status });
      renderWithProviders(<AgentHeader {...baseProps} session={session} />);
      expect(screen.queryByRole('button', { name: /pause workflow/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /resume workflow/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /stop workflow/i })).toBeNull();
    },
  );

  it('renders niche-context chip with delete handler when niche_context is set', async () => {
    const user = userEvent.setup();
    const onClearNiche = vi.fn();
    const session = buildSession({
      niche_context: { id: 'n1', name: 'Funny Cats' },
    });
    renderWithProviders(
      <AgentHeader {...baseProps} session={session} onClearNiche={onClearNiche} />,
    );
    expect(screen.getByText('Funny Cats')).toBeInTheDocument();
    // Chip's deleteIcon is rendered as a button-like element. Click it.
    const chip = screen.getByText('Funny Cats').closest('.MuiChip-root');
    expect(chip).not.toBeNull();
    const deleteIcon = chip!.querySelector('.MuiChip-deleteIcon');
    expect(deleteIcon).not.toBeNull();
    await user.click(deleteIcon as HTMLElement);
    expect(onClearNiche).toHaveBeenCalled();
  });

  it('renders budget bar when budgetPercent > 0', () => {
    const session = buildSession({ status: 'running' });
    renderWithProviders(
      <AgentHeader {...baseProps} session={session} budgetPercent={45} />,
    );
    expect(screen.getByText(/45%/)).toBeInTheDocument();
  });

  it('does not render budget bar when budgetPercent is 0', () => {
    const session = buildSession({ status: 'running' });
    renderWithProviders(
      <AgentHeader {...baseProps} session={session} budgetPercent={0} />,
    );
    expect(screen.queryByText(/0%/)).toBeNull();
  });

  it('renders autonomy preset chip', () => {
    const session = buildSession({
      status: 'running',
      autonomy_preset: 'autonomous',
    });
    renderWithProviders(<AgentHeader {...baseProps} session={session} />);
    expect(screen.getByText('autonomous')).toBeInTheDocument();
  });

  it('handles null session gracefully — only renders share + settings buttons', () => {
    renderWithProviders(<AgentHeader {...baseProps} session={null} />);
    expect(screen.queryByRole('button', { name: /pause workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /resume workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stop workflow/i })).toBeNull();
    expect(screen.getByRole('button', { name: /share with workspace/i })).toBeInTheDocument();
  });

  it('clicking Pause invokes onPause', async () => {
    const user = userEvent.setup();
    const onPause = vi.fn();
    const session = buildSession({ status: 'running' });
    renderWithProviders(
      <AgentHeader {...baseProps} session={session} onPause={onPause} />,
    );
    await user.click(screen.getByRole('button', { name: /pause workflow/i }));
    expect(onPause).toHaveBeenCalled();
  });

  it('AC-61: hides Pause/Stop and Share when readOnly is true (non-owner viewing shared)', () => {
    const session = buildSession({
      status: 'running',
      is_shared: true,
      created_by_email: 'someone-else@example.com',
    });
    renderWithProviders(
      <AgentHeader
        {...baseProps}
        session={session}
        isOwner={false}
        readOnly={true}
      />,
    );
    expect(screen.queryByRole('button', { name: /pause workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /resume workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stop workflow/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /share with workspace/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /stop sharing/i })).toBeNull();
  });

  it('AC-60: clicking Unshare invokes onUnshare when session is_shared', async () => {
    const user = userEvent.setup();
    const onUnshare = vi.fn();
    const session = buildSession({ status: 'running', is_shared: true });
    renderWithProviders(
      <AgentHeader {...baseProps} session={session} onUnshare={onUnshare} />,
    );
    await user.click(screen.getByRole('button', { name: /stop sharing/i }));
    expect(onUnshare).toHaveBeenCalled();
  });
});
