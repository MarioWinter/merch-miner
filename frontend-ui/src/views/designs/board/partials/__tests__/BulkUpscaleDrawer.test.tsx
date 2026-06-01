/**
 * FIX-canvas-editor-bugs-and-image-gen Phase D #2 — BulkUpscaleDrawer is now
 * a self-contained, globally-mounted drawer. Reads `drawerOpen` +
 * `activeBatchId` from Redux and pulls live job rows via `useUpscaleBatch`.
 * Adds per-job Cancel for pending/running rows alongside the existing Retry
 * button for failed rows.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import upscaleReducer from '@/store/upscaleSlice';
import BulkUpscaleDrawer from '../BulkUpscaleDrawer';
import type { UpscaleBatchJobRow } from '@/store/upscaleApi';

// -----------------------------------------------------------------
// Mocks — RTK Query hooks + useUpscaleBatch
// -----------------------------------------------------------------

const retryMutation = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({}) });
let cancelMutationImpl: (jobId: string) => { unwrap: () => Promise<unknown> } =
  () => ({ unwrap: () => Promise.resolve({}) });
const cancelMutation = vi.fn((jobId: string) => cancelMutationImpl(jobId));

vi.mock('@/store/upscaleApi', async (importActual) => {
  const actual = await importActual<typeof import('@/store/upscaleApi')>();
  return {
    ...actual,
    useTriggerSingleMutation: () => [retryMutation, { isLoading: false }],
    useCancelUpscaleJobMutation: () => [cancelMutation, { isLoading: false }],
  };
});

vi.mock('../../hooks/useUpscaleBatch', () => ({
  useUpscaleBatch: vi.fn(),
}));

import { useUpscaleBatch } from '../../hooks/useUpscaleBatch';

const mockedUseUpscaleBatch = useUpscaleBatch as unknown as ReturnType<typeof vi.fn>;

// -----------------------------------------------------------------
// Fixtures
// -----------------------------------------------------------------

const buildJobs = (): UpscaleBatchJobRow[] => [
  {
    job_id: 'j1',
    design_id: 'd1',
    status: 'completed',
    design_label: 'Design 1',
    thumbnail_url: '/x.png',
    error_message: null,
    retry_count: 0,
  },
  {
    job_id: 'j2',
    design_id: 'd2',
    status: 'running',
    design_label: 'Design 2',
    thumbnail_url: '/y.png',
    error_message: null,
    retry_count: 0,
  },
  {
    job_id: 'j3',
    design_id: 'd3',
    status: 'failed',
    design_label: 'Design 3',
    thumbnail_url: '/z.png',
    error_message: 'replicate_unavailable',
    retry_count: 1,
  },
  {
    job_id: 'j4',
    design_id: 'd4',
    status: 'failed',
    design_label: 'Design 4',
    thumbnail_url: '/w.png',
    error_message: 'invalid_input',
    retry_count: 3,
  },
];

const buildPendingRunningJobs = (): UpscaleBatchJobRow[] => [
  {
    job_id: 'jp',
    design_id: 'dp',
    status: 'pending',
    design_label: 'Pending Design',
    thumbnail_url: null,
    error_message: null,
    retry_count: 0,
  },
  {
    job_id: 'jr',
    design_id: 'dr',
    status: 'running',
    design_label: 'Running Design',
    thumbnail_url: null,
    error_message: null,
    retry_count: 0,
  },
];

const drawerOpenState = {
  upscale: {
    activeBatchId: 'b-test',
    drawerOpen: true,
    destinationByWorkspace: {},
    cloudTargetByWorkspace: {},
    hideCompletedInDrawer: false,
    processingDesignIds: [] as string[],
    lastCompletion: null,
  },
};

const setHook = (jobs: UpscaleBatchJobRow[]): void => {
  mockedUseUpscaleBatch.mockReturnValue({
    batch: { batch_id: 'b-test', is_terminal: false, jobs },
    jobs,
    isFetchingStatus: false,
    isTriggering: false,
    preflight: { open: false, used: 0, limit: 0, resets_on: '', selectedIds: [] },
    triggerBulk: vi.fn(),
    closePreflight: vi.fn(),
    confirmPreflightFirstN: vi.fn(),
  });
};

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('BulkUpscaleDrawer', () => {
  beforeEach(() => {
    retryMutation.mockClear();
    cancelMutation.mockClear();
    cancelMutationImpl = () => ({ unwrap: () => Promise.resolve({}) });
    mockedUseUpscaleBatch.mockReset();
  });

  it('renders header + per-job rows when drawer is open', () => {
    setHook(buildJobs());
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    // Header batch id (truncated 8 chars).
    expect(screen.getByText(/b-test/i)).toBeInTheDocument();
    // 4 jobs visible.
    const jobItems = document.querySelectorAll('[class*="MuiListItem-root"]');
    expect(jobItems.length).toBe(4);
  });

  it('hides completed rows when "Clear completed" is toggled', async () => {
    setHook(buildJobs());
    const user = userEvent.setup();
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    await user.click(screen.getByRole('button', { name: /clear completed/i }));
    // Now only 3 visible (running + 2 failed)
    const jobItems = document.querySelectorAll('[class*="MuiListItem-root"]');
    expect(jobItems.length).toBe(3);
  });

  it('disables retry button after 3 attempts with same error', () => {
    setHook(buildJobs());
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    // The 4th job (j4) has retry_count=3 and an error_message → should be disabled.
    const retryButtons = screen.getAllByRole('button', { name: /^retry$/i });
    // j3 (retry_count=1, has error) — enabled
    // j4 (retry_count=3, has error) — disabled
    expect(retryButtons.length).toBe(2);
    expect(retryButtons[0]).not.toBeDisabled();
    expect(retryButtons[1]).toBeDisabled();
  });

  it('Close button dispatches closeDrawer (drawerOpen=false)', async () => {
    setHook(buildJobs());
    const user = userEvent.setup();
    const { store } = renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    expect(store.getState().upscale.drawerOpen).toBe(true);
    // Both the header icon-button and the footer button share name "Close" —
    // either one dispatches closeDrawer. Click the first match.
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);
    expect(store.getState().upscale.drawerOpen).toBe(false);
  });

  it('Dismiss batch clears activeBatchId AND closes drawer', async () => {
    setHook(buildJobs());
    const user = userEvent.setup();
    const { store } = renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    await user.click(screen.getByRole('button', { name: /dismiss batch/i }));
    expect(store.getState().upscale.activeBatchId).toBeNull();
    expect(store.getState().upscale.drawerOpen).toBe(false);
  });

  // -----------------------------------------------------------------
  // Phase D #2 — per-job Cancel button
  // -----------------------------------------------------------------

  it('renders Cancel button for pending and running jobs', () => {
    setHook(buildPendingRunningJobs());
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    const cancelButtons = screen.getAllByRole('button', {
      name: /cancel upscale job/i,
    });
    expect(cancelButtons.length).toBe(2);
  });

  it('does NOT render Cancel button for completed jobs', () => {
    setHook([
      {
        job_id: 'jc',
        design_id: 'dc',
        status: 'completed',
        design_label: 'Done',
        thumbnail_url: null,
        error_message: null,
        retry_count: 0,
      },
    ]);
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    expect(
      screen.queryByRole('button', { name: /cancel upscale job/i }),
    ).not.toBeInTheDocument();
  });

  it('does NOT render Cancel button for failed jobs (Retry stays)', () => {
    setHook([
      {
        job_id: 'jf',
        design_id: 'df',
        status: 'failed',
        design_label: 'Failed',
        thumbnail_url: null,
        error_message: 'oops',
        retry_count: 1,
      },
    ]);
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    expect(
      screen.queryByRole('button', { name: /cancel upscale job/i }),
    ).not.toBeInTheDocument();
    // Retry button is present for the failed row.
    expect(
      screen.getByRole('button', { name: /^retry$/i }),
    ).toBeInTheDocument();
  });

  it('clicking Cancel fires the mutation with the correct job_id', async () => {
    setHook(buildPendingRunningJobs());
    const user = userEvent.setup();
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    const cancelButtons = screen.getAllByRole('button', {
      name: /cancel upscale job/i,
    });
    await user.click(cancelButtons[0]);
    await waitFor(() => {
      expect(cancelMutation).toHaveBeenCalledWith('jp');
    });
  });

  it('Cancel button is disabled while the mutation is in-flight', async () => {
    setHook(buildPendingRunningJobs());
    let resolveCancel: (value: unknown) => void = () => {};
    cancelMutationImpl = () => ({
      unwrap: () =>
        new Promise((resolve) => {
          resolveCancel = resolve;
        }),
    });
    const user = userEvent.setup();
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    const cancelButtons = screen.getAllByRole('button', {
      name: /cancel upscale job/i,
    });
    await user.click(cancelButtons[0]);
    await waitFor(() => {
      const buttons = screen.getAllByRole('button', {
        name: /cancel upscale job/i,
      });
      expect(buttons[0]).toBeDisabled();
    });
    // Second row's button stays enabled — per-row disable.
    const buttonsAfter = screen.getAllByRole('button', {
      name: /cancel upscale job/i,
    });
    expect(buttonsAfter[1]).not.toBeDisabled();
    // Resolve inside act() so React commits the resulting state updates
    // (snackbar enqueue + Set removal) before the test tears down.
    await act(async () => {
      resolveCancel({});
      // Allow microtasks (mutation .unwrap() resolution chain) to flush.
      await Promise.resolve();
    });
  });

  it('fires success snackbar on 200 response', async () => {
    setHook(buildPendingRunningJobs());
    const user = userEvent.setup();
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    await user.click(
      screen.getAllByRole('button', { name: /cancel upscale job/i })[0],
    );
    expect(
      await screen.findByText(/upscale cancelled/i),
    ).toBeInTheDocument();
  });

  it('fires error snackbar on rejected mutation', async () => {
    setHook(buildPendingRunningJobs());
    cancelMutationImpl = () => ({
      unwrap: () => Promise.reject(new Error('boom')),
    });
    const user = userEvent.setup();
    renderWithProviders(<BulkUpscaleDrawer />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: drawerOpenState,
    });
    await user.click(
      screen.getAllByRole('button', { name: /cancel upscale job/i })[0],
    );
    expect(
      await screen.findByText(/could not cancel/i),
    ).toBeInTheDocument();
  });
});
