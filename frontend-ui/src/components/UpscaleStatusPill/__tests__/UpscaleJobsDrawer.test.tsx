/**
 * FIX-canvas-editor-bugs-and-image-gen Phase B — UpscaleJobsDrawer.
 *
 * The drawer is a pure render of the two job buckets (single-design + batch).
 * State is owned by the parent pill, so we just verify rendered structure
 * and close-button wiring.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import UpscaleJobsDrawer from '../partials/UpscaleJobsDrawer';
import type { UpscaleBatchJobRow } from '@/store/upscaleApi';

const makeJob = (overrides: Partial<UpscaleBatchJobRow> = {}): UpscaleBatchJobRow => ({
  design_id: 'batch-design-1',
  job_id: 'job-1',
  status: 'running',
  design_label: 'Test design',
  thumbnail_url: null,
  error_message: null,
  retry_count: 0,
  ...overrides,
});

describe('UpscaleJobsDrawer', () => {
  it('renders 2 single + 1 batch row with per-source labels', () => {
    renderWithProviders(
      <UpscaleJobsDrawer
        open
        onClose={() => undefined}
        batchJobs={[makeJob()]}
        singleDesignIds={['single-a', 'single-b']}
      />,
    );
    expect(screen.getAllByTestId('upscale-job-row-single')).toHaveLength(2);
    expect(screen.getAllByTestId('upscale-job-row-batch')).toHaveLength(1);
    // Source-label substring proof: both Editor + Batch source words appear.
    expect(screen.getByText(/single-a · Editor/i)).toBeInTheDocument();
    expect(screen.getByText(/batch-de · Batch/i)).toBeInTheDocument();
  });

  it('shows the empty state when no jobs are in flight', () => {
    renderWithProviders(
      <UpscaleJobsDrawer
        open
        onClose={() => undefined}
        batchJobs={[]}
        singleDesignIds={[]}
      />,
    );
    expect(screen.getByText(/no upscales running/i)).toBeInTheDocument();
  });

  it('invokes onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <UpscaleJobsDrawer
        open
        onClose={onClose}
        batchJobs={[]}
        singleDesignIds={['x']}
      />,
    );
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
