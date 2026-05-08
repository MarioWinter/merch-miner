import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import upscaleReducer, { setActiveBatch } from '@/store/upscaleSlice';
import UpscaleStatusPill from '../UpscaleStatusPill';

// Mock the polling hook so we can drive batch state directly without RTK Query.
vi.mock('../../hooks/useUpscaleBatch', () => ({
  useUpscaleBatch: vi.fn(),
}));

import { useUpscaleBatch } from '../../hooks/useUpscaleBatch';

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

describe('UpscaleStatusPill', () => {
  beforeEach(() => {
    mockedHook.mockReset();
  });

  it('renders nothing when no activeBatchId is set', () => {
    mockedHook.mockReturnValue(baseHookReturn);
    const { container } = renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
    });
    expect(container).toBeEmptyDOMElement();
  });

  it('renders pill with counter when batch is active', () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      batch: {
        batch_id: 'b1',
        is_terminal: false,
        jobs: [
          { status: 'completed' },
          { status: 'running' },
          { status: 'pending' },
        ],
      },
    });
    const { store } = renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: {
          activeBatchId: 'b1',
          drawerOpen: false,
          destinationByWorkspace: {},
          cloudTargetByWorkspace: {},
          hideCompletedInDrawer: false,
        },
      },
    });
    void store; // satisfy the unused-var rule when not asserting on store
    expect(screen.getByText(/1\/3/)).toBeInTheDocument();
  });

  it('renders "starting…" when batch is set but jobs not yet returned', () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      batch: undefined,
    });
    renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: {
          activeBatchId: 'b1',
          drawerOpen: false,
          destinationByWorkspace: {},
          cloudTargetByWorkspace: {},
          hideCompletedInDrawer: false,
        },
      },
    });
    expect(screen.getByText(/upscaling/i)).toBeInTheDocument();
  });

  it('opens drawer on click', async () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      batch: {
        batch_id: 'b1',
        is_terminal: false,
        jobs: [{ status: 'pending' }],
      },
    });
    const user = userEvent.setup();
    const { store } = renderWithProviders(<UpscaleStatusPill />, {
      reducers: { upscale: upscaleReducer },
      preloadedState: {
        upscale: {
          activeBatchId: 'b1',
          drawerOpen: false,
          destinationByWorkspace: {},
          cloudTargetByWorkspace: {},
          hideCompletedInDrawer: false,
        },
      },
    });
    expect(store.getState().upscale.drawerOpen).toBe(false);
    await user.click(screen.getByRole('button'));
    expect(store.getState().upscale.drawerOpen).toBe(true);
  });
});
