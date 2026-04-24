import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import type {
  FlyingUploadExportBody,
  FlyingUploadPreviewResponse,
} from '../types';

// ---------------------------------------------------------------------------
// Mocks — stub the RTK mutation hooks + notistack + i18n. Keep the wrapper
// minimal so renderHook can mount without dragging in the full provider
// tree. The hook only needs `useSnackbar` + `useTranslation`, which we mock.
// ---------------------------------------------------------------------------

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({
  useSnackbar: () => ({
    enqueueSnackbar: mockEnqueueSnackbar,
    closeSnackbar: vi.fn(),
  }),
}));

const stableT = (key: string, opts?: { defaultValue?: string }) =>
  opts?.defaultValue ?? key;
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: stableT }),
}));

const previewUnwrap = vi.fn();
const runUnwrap = vi.fn();
const previewTrigger = vi.fn(() => ({ unwrap: previewUnwrap }));
const runTrigger = vi.fn(() => ({ unwrap: runUnwrap }));
let previewLoading = false;
let runLoading = false;

vi.mock('@/store/publishSlice', () => ({
  usePreviewExportMutation: () => [previewTrigger, { isLoading: previewLoading }],
  useRunExportMutation: () => [runTrigger, { isLoading: runLoading }],
}));

import { useExport, DOWNLOAD_TIMEOUT_MS } from '../hooks/useExport';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeBody = (): FlyingUploadExportBody => ({
  template: 'mba',
  format: 'xlsx',
  design_ids: ['d1', 'd2'],
});

const makePreview = (
  overrides: Partial<FlyingUploadPreviewResponse> = {},
): FlyingUploadPreviewResponse => ({
  total_designs: 2,
  ready_rows: 2,
  skipped: [],
  warnings: [],
  ...overrides,
});

const Wrapper = ({ children }: { children: ReactNode }) =>
  createElement('div', null, children);

// ---------------------------------------------------------------------------
// Tests — Phase W1
// ---------------------------------------------------------------------------

describe('useExport', () => {
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockEnqueueSnackbar.mockClear();
    previewTrigger.mockClear();
    runTrigger.mockClear();
    previewUnwrap.mockReset();
    runUnwrap.mockReset();
    previewLoading = false;
    runLoading = false;

    if (!('createObjectURL' in URL)) {
      (URL as unknown as { createObjectURL: () => string }).createObjectURL =
        () => '';
      (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL =
        () => {};
    }
    createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock');
    revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
    vi.useRealTimers();
  });

  it('preflight returns the parsed summary on success', async () => {
    const summary = makePreview();
    previewUnwrap.mockResolvedValue(summary);

    const { result } = renderHook(() => useExport(), { wrapper: Wrapper });

    const body = makeBody();
    let got: FlyingUploadPreviewResponse | null = null;
    await act(async () => {
      got = await result.current.preflight(body);
    });

    expect(previewTrigger).toHaveBeenCalledWith(body);
    expect(got).toEqual(summary);
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it('preflight surfaces a snackbar and returns null on backend error', async () => {
    previewUnwrap.mockRejectedValue({
      data: { error: { code: 'max_500_designs_per_export' } },
    });

    const { result } = renderHook(() => useExport(), { wrapper: Wrapper });

    let got: FlyingUploadPreviewResponse | null = makePreview();
    await act(async () => {
      got = await result.current.preflight(makeBody());
    });

    expect(got).toBeNull();
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), {
        variant: 'error',
      });
    });
  });

  it('download triggers an anchor click + revokes the object URL', async () => {
    runUnwrap.mockResolvedValue({
      blob: new Blob(['x']),
      filename: 'export.xlsx',
    });

    const { result } = renderHook(() => useExport(), { wrapper: Wrapper });

    let ok = false;
    await act(async () => {
      ok = await result.current.download(makeBody());
    });

    expect(ok).toBe(true);
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    await waitFor(() => expect(revokeObjectURLSpy).toHaveBeenCalled());
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it('download times out after DOWNLOAD_TIMEOUT_MS and surfaces timeout error', async () => {
    vi.useFakeTimers();
    runUnwrap.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useExport(), { wrapper: Wrapper });

    let ok = true;
    const promise = act(async () => {
      ok = await result.current.download(makeBody());
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DOWNLOAD_TIMEOUT_MS + 10);
    });
    await promise;

    expect(ok).toBe(false);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), {
      variant: 'error',
    });
  });

  it('download returns false + surfaces snackbar on backend error', async () => {
    runUnwrap.mockRejectedValue({
      data: { error: { code: 'no_enabled_products' } },
    });

    const { result } = renderHook(() => useExport(), { wrapper: Wrapper });

    let ok = true;
    await act(async () => {
      ok = await result.current.download(makeBody());
    });

    expect(ok).toBe(false);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.any(String), {
      variant: 'error',
    });
  });
});
