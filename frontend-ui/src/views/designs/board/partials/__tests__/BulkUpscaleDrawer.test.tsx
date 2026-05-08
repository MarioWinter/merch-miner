import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import upscaleReducer from '@/store/upscaleSlice';
import BulkUpscaleDrawer from '../BulkUpscaleDrawer';

// Mock single-trigger mutation so retry-row clicks don't blow up.
const retryMutation = vi.fn().mockReturnValue({ unwrap: () => Promise.resolve({}) });

vi.mock('@/store/upscaleApi', async (importActual) => {
  const actual = await importActual<typeof import('@/store/upscaleApi')>();
  return {
    ...actual,
    useTriggerSingleMutation: () => [retryMutation, { isLoading: false }],
  };
});

const buildJobs = () => [
  { id: 'j1', design_id: 'd1', status: 'completed' as const, error_message: '', retry_count: 0, design: { id: 'd1', image_file: '/x.png' } },
  { id: 'j2', design_id: 'd2', status: 'running' as const, error_message: '', retry_count: 0, design: { id: 'd2', image_file: '/y.png' } },
  { id: 'j3', design_id: 'd3', status: 'failed' as const, error_message: 'replicate_unavailable', retry_count: 1, design: { id: 'd3', image_file: '/z.png' } },
  { id: 'j4', design_id: 'd4', status: 'failed' as const, error_message: 'invalid_input', retry_count: 3, design: { id: 'd4', image_file: '/w.png' } },
];

const drawerOpenState = {
  upscale: {
    activeBatchId: 'b-test',
    drawerOpen: true,
    destinationByWorkspace: {},
    cloudTargetByWorkspace: {},
    hideCompletedInDrawer: false,
  },
};

describe('BulkUpscaleDrawer', () => {
  beforeEach(() => {
    retryMutation.mockClear();
  });

  it('renders header + per-job rows when drawer is open', () => {
    renderWithProviders(
      <BulkUpscaleDrawer jobs={buildJobs()} batchId="b-test" />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: drawerOpenState,
      },
    );
    // Header batch id (truncated 8 chars).
    expect(screen.getByText(/b-test/i)).toBeInTheDocument();
    // 4 jobs visible.
    const jobItems = document.querySelectorAll('[class*="MuiListItem-root"]');
    expect(jobItems.length).toBe(4);
  });

  it('hides completed rows when "Clear completed" is toggled', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <BulkUpscaleDrawer jobs={buildJobs()} batchId="b-test" />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: drawerOpenState,
      },
    );
    await user.click(screen.getByRole('button', { name: /clear completed/i }));
    // Now only 3 visible (running + 2 failed)
    const jobItems = document.querySelectorAll('[class*="MuiListItem-root"]');
    expect(jobItems.length).toBe(3);
  });

  it('disables retry button after 3 attempts with same error', () => {
    renderWithProviders(
      <BulkUpscaleDrawer jobs={buildJobs()} batchId="b-test" />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: drawerOpenState,
      },
    );
    // The 4th job (j4) has retry_count=3 and an error_message → should be disabled.
    const retryButtons = screen.getAllByRole('button', { name: /retry/i });
    // j3 (retry_count=1, has error) — enabled
    // j4 (retry_count=3, has error) — disabled
    expect(retryButtons.length).toBe(2);
    expect(retryButtons[0]).not.toBeDisabled();
    expect(retryButtons[1]).toBeDisabled();
  });

  it('Close button dispatches closeDrawer (drawerOpen=false)', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(
      <BulkUpscaleDrawer jobs={buildJobs()} batchId="b-test" />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: drawerOpenState,
      },
    );
    expect(store.getState().upscale.drawerOpen).toBe(true);
    // Both the header icon-button and the footer button share name "Close" —
    // either one dispatches closeDrawer. Click the first match.
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    await user.click(closeButtons[0]);
    expect(store.getState().upscale.drawerOpen).toBe(false);
  });

  it('Dismiss batch clears activeBatchId AND closes drawer', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(
      <BulkUpscaleDrawer jobs={buildJobs()} batchId="b-test" />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: drawerOpenState,
      },
    );
    await user.click(screen.getByRole('button', { name: /dismiss batch/i }));
    expect(store.getState().upscale.activeBatchId).toBeNull();
    expect(store.getState().upscale.drawerOpen).toBe(false);
  });
});
