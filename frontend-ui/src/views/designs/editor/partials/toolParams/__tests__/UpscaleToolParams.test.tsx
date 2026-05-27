import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import upscaleReducer from '@/store/upscaleSlice';
import { UpscaleToolParams } from '../UpscaleToolParams';

// Mock the upscale-single hook so we don't need RTK Query infrastructure.
vi.mock('../../../hooks/useUpscaleSingle', () => ({
  useUpscaleSingle: vi.fn(),
}));

// UpscaleQuotaIndicator + UpscaleDestinationToggle pull RTK Query / cloud
// hooks that aren't relevant for this panel-rendering test — neutralize.
vi.mock('@/views/designs/board/partials/UpscaleQuotaIndicator', () => ({
  default: () => null,
}));
vi.mock('@/views/designs/board/partials/UpscaleDestinationToggle', () => ({
  default: () => null,
}));
vi.mock('@/views/designs/board/partials/PickCloudFolderDialog', () => ({
  default: () => null,
}));

import { useUpscaleSingle } from '../../../hooks/useUpscaleSingle';

const mockedHook = useUpscaleSingle as unknown as ReturnType<typeof vi.fn>;

const baseHookReturn = {
  isProcessing: false,
  isTriggering: false,
  jobId: null,
  needsConfirmation: false,
  triggerUpscale: vi.fn().mockResolvedValue(undefined),
  cancelConfirmation: vi.fn(),
  runUpscaleAsync: vi.fn().mockResolvedValue(undefined),
};

const baseState = {
  upscale: {
    activeBatchId: null,
    drawerOpen: false,
    destinationByWorkspace: {},
    cloudTargetByWorkspace: {},
    hideCompletedInDrawer: false,
  },
};

const noopChange = () => {};

describe('UpscaleToolParams (Minimal Panel)', () => {
  beforeEach(() => {
    mockedHook.mockReset();
    mockedHook.mockReturnValue(baseHookReturn);
  });

  it('renders the current size and target chips', () => {
    renderWithProviders(
      <UpscaleToolParams
        params={{}}
        onChange={noopChange}
        designId="d1"
        imageWidth={1024}
        imageHeight={1024}
      />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: baseState,
      },
    );
    // Current 1024x1024, target 4500x5400
    expect(screen.getByText(/1024/)).toBeInTheDocument();
    expect(screen.getByText(/4500/)).toBeInTheDocument();
    expect(screen.getByText(/5400/)).toBeInTheDocument();
  });

  it('shows the "Upscale Now" CTA button', () => {
    renderWithProviders(
      <UpscaleToolParams
        params={{}}
        onChange={noopChange}
        designId="d1"
      />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: baseState,
      },
    );
    expect(screen.getByRole('button', { name: /upscale now/i })).toBeInTheDocument();
  });

  it('disables Upscale Now while a trigger is in flight', () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      isTriggering: true,
    });
    renderWithProviders(
      <UpscaleToolParams
        params={{}}
        onChange={noopChange}
        designId="d1"
      />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: baseState,
      },
    );
    expect(screen.getByRole('button', { name: /upscaling|upscale now/i })).toBeDisabled();
  });

  it('renders re-upscale ConfirmDialog when needsConfirmation=true', () => {
    mockedHook.mockReturnValue({
      ...baseHookReturn,
      needsConfirmation: true,
    });
    renderWithProviders(
      <UpscaleToolParams
        params={{}}
        onChange={noopChange}
        designId="d1"
      />,
      {
        reducers: { upscale: upscaleReducer },
        preloadedState: baseState,
      },
    );
    // Dialog has wording "Re-upscale this design?"
    expect(screen.getByText(/re-upscale this design/i)).toBeInTheDocument();
  });
});
