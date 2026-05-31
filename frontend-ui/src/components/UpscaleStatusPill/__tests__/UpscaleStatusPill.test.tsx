/**
 * FIX-canvas-editor-bugs-and-image-gen Phase B — promoted UpscaleStatusPill.
 *
 * Covers the post-promotion behavior: the pill now subscribes to BOTH the
 * batch path (`upscaleSlice.activeBatchId`) AND the single-design path
 * (`upscaleSlice.processingDesignIds`). The aggregated label sums totals
 * across both buckets. Click opens a per-job drawer.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import upscaleReducer from '@/store/upscaleSlice';
import UpscaleStatusPill from '../index';

vi.mock('@/views/designs/board/hooks/useUpscaleBatch', () => ({
  useUpscaleBatch: vi.fn(),
}));

import { useUpscaleBatch } from '@/views/designs/board/hooks/useUpscaleBatch';

const mockedHook = useUpscaleBatch as unknown as ReturnType<typeof vi.fn>;

const baseHookReturn = {
  batch: undefined,
  jobs: [],
  isFetchingStatus: false,
  isTriggering: false,
  preflight: { open: false, used: 0, limit: 0, resets_on: '', selectedIds: [] },
  triggerBulk: vi.fn(),
  closePreflight: vi.fn(),
  confirmPreflightFirstN: vi.fn(),
};

const baseUpscaleState = {
  activeBatchId: null,
  drawerOpen: false,
  destinationByWorkspace: {},
  cloudTargetByWorkspace: {},
  hideCompletedInDrawer: false,
  processingDesignIds: [] as string[],
  lastCompletion: null,
};

describe('UpscaleStatusPill', () => {
  beforeEach(() => {
    mockedHook.mockReset();
    mockedHook.mockReturnValue(baseHookReturn);
  });

  it('renders nothing when no batch and no single-design jobs', () => {
    const { container } = renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: { upscale: baseUpscaleState },
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pill with counter for batch-only state', () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      batch: {
        batch_id: 'b1',
        is_terminal: false,
        jobs: [
          { design_id: 'd1', job_id: 'j1', status: 'completed', design_label: '', thumbnail_url: null, error_message: null, retry_count: 0 },
          { design_id: 'd2', job_id: 'j2', status: 'running', design_label: '', thumbnail_url: null, error_message: null, retry_count: 0 },
          { design_id: 'd3', job_id: 'j3', status: 'pending', design_label: '', thumbnail_url: null, error_message: null, retry_count: 0 },
        ],
      },
    });
    renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: { ...baseUpscaleState, activeBatchId: 'b1' },
      },
    });
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it('renders pill for single-design-only state (no active batch)', () => {
    renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: {
          ...baseUpscaleState,
          processingDesignIds: ['design-1', 'design-2'],
        },
      },
    });
    expect(screen.getByText(/0\/2/)).toBeInTheDocument();
  });

  it('renders pill with summed label for combined batch + single state', () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      batch: {
        batch_id: 'b1',
        is_terminal: false,
        jobs: [
          { design_id: 'd1', job_id: 'j1', status: 'completed', design_label: '', thumbnail_url: null, error_message: null, retry_count: 0 },
          { design_id: 'd2', job_id: 'j2', status: 'pending', design_label: '', thumbnail_url: null, error_message: null, retry_count: 0 },
        ],
      },
    });
    renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: {
          ...baseUpscaleState,
          activeBatchId: 'b1',
          processingDesignIds: ['design-1', 'design-2'],
        },
      },
    });
    // batchTotal=2, singleTotal=2 -> total=4; batchCompleted=1 -> completed=1
    expect(screen.getByText(/1\/4/)).toBeInTheDocument();
  });

  it('opens the drawer on click and lists per-source rows', async () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      batch: {
        batch_id: 'b1',
        is_terminal: false,
        jobs: [
          { design_id: 'batch-d-1', job_id: 'j1', status: 'running', design_label: '', thumbnail_url: null, error_message: null, retry_count: 0 },
        ],
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: {
          ...baseUpscaleState,
          activeBatchId: 'b1',
          processingDesignIds: ['single-d-1'],
        },
      },
    });

    await user.click(screen.getByRole('button'));

    expect(
      await screen.findByRole('dialog', { name: /running upscales/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId('upscale-job-row-single')).toHaveLength(1);
    expect(screen.getAllByTestId('upscale-job-row-batch')).toHaveLength(1);
  });
});
