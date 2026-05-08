import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SnackbarProvider } from 'notistack';
import { CssVarsProvider } from '@mui/material/styles';
import { initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import upscaleReducer from '@/store/upscaleSlice';
import workspaceReducer from '@/store/workspaceSlice';
import authReducer from '@/store/authSlice';
import theme from '@/style/theme';
import enTranslation from '../../../../../../public/locales/en/translation.json';
import { useUpscaleBatch } from '../useUpscaleBatch';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

// Mock RTK Query hooks the hook depends on. We don't mount the upscaleApi
// reducer, so spy these and verify dispatch behavior via Redux state.
const triggerMutation = vi.fn();
const triggerMutationResult = { isLoading: false };

vi.mock('@/store/upscaleApi', async (importActual) => {
  const actual = await importActual<typeof import('@/store/upscaleApi')>();
  return {
    ...actual,
    useTriggerBulkMutation: () => [triggerMutation, triggerMutationResult],
    useGetBatchStatusQuery: () => ({
      data: undefined,
      isFetching: false,
    }),
  };
});

const buildWrapper = (preloadedState?: Record<string, unknown>) => {
  const store = configureStore({
    reducer: {
      auth: authReducer,
      workspace: workspaceReducer,
      upscale: upscaleReducer,
    },
    preloadedState: preloadedState as never,
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <CssVarsProvider theme={theme} defaultMode="dark">
        <SnackbarProvider>{children}</SnackbarProvider>
      </CssVarsProvider>
    </Provider>
  );
  return { store, wrapper };
};

describe('useUpscaleBatch', () => {
  beforeEach(() => {
    triggerMutation.mockReset();
  });

  it('triggerBulk returns early on empty designIds without firing the mutation', async () => {
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpscaleBatch({ activeBatchId: null }), {
      wrapper,
    });
    await act(async () => {
      await result.current.triggerBulk([], { replace: false });
    });
    expect(triggerMutation).not.toHaveBeenCalled();
  });

  it('opens drawer + sets activeBatchId on a successful trigger with batch_id', async () => {
    triggerMutation.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          batch_id: 'b-new',
          jobs: [],
          skipped_quota: 0,
          skipped_already_upscaled: 0,
        }),
    });
    const { store, wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpscaleBatch({ activeBatchId: null }), {
      wrapper,
    });
    await act(async () => {
      await result.current.triggerBulk(['d1', 'd2']);
    });
    await waitFor(() => {
      expect(store.getState().upscale.activeBatchId).toBe('b-new');
      expect(store.getState().upscale.drawerOpen).toBe(true);
    });
  });

  it('keeps activeBatchId untouched when backend returns batch_id=null', async () => {
    triggerMutation.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          batch_id: null,
          jobs: [],
          skipped_quota: 0,
          skipped_already_upscaled: 2,
        }),
    });
    const { store, wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpscaleBatch({ activeBatchId: null }), {
      wrapper,
    });
    await act(async () => {
      await result.current.triggerBulk(['d1', 'd2']);
    });
    expect(store.getState().upscale.activeBatchId).toBeNull();
    expect(store.getState().upscale.drawerOpen).toBe(false);
  });

  it('opens preflight dialog on a 402 quota response', async () => {
    triggerMutation.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 402,
          data: { used: 100, limit: 100, resets_on: '2026-06-01' },
        }),
    });
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpscaleBatch({ activeBatchId: null }), {
      wrapper,
    });
    await act(async () => {
      await result.current.triggerBulk(['d1', 'd2', 'd3']);
    });
    await waitFor(() => {
      expect(result.current.preflight.open).toBe(true);
      expect(result.current.preflight.limit).toBe(100);
      expect(result.current.preflight.selectedIds).toEqual(['d1', 'd2', 'd3']);
    });
  });

  it('closePreflight flips preflight.open back to false', async () => {
    const { wrapper } = buildWrapper();
    const { result } = renderHook(() => useUpscaleBatch({ activeBatchId: null }), {
      wrapper,
    });
    // First simulate an open preflight
    triggerMutation.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 402,
          data: { used: 100, limit: 100, resets_on: '2026-06-01' },
        }),
    });
    await act(async () => {
      await result.current.triggerBulk(['d1']);
    });
    await waitFor(() => expect(result.current.preflight.open).toBe(true));
    act(() => {
      result.current.closePreflight();
    });
    expect(result.current.preflight.open).toBe(false);
  });
});
