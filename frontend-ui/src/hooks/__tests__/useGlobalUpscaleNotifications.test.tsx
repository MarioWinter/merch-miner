/**
 * FIX-canvas-editor-bugs-and-image-gen Phase B — app-level snackbar reactor.
 *
 * Strategy: drive Redux state directly (the hook only reads
 * `s.upscale.lastCompletion`). notistack + react-router are mocked so we can
 * assert on snackbar args + navigation. Action button rendering is verified
 * by invoking the action thunk returned to notistack.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, render, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import upscaleReducer, {
  recordCompletion,
} from '@/store/upscaleSlice';

// ---- hoisted mocks ----
const { mockEnqueue, mockClose, mockNavigate } = vi.hoisted(() => ({
  mockEnqueue: vi.fn(),
  mockClose: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock('notistack', () => ({
  useSnackbar: () => ({ enqueueSnackbar: mockEnqueue }),
  closeSnackbar: mockClose,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? key,
  }),
}));

// ---- code under test (imported after mocks) ----
import { useGlobalUpscaleNotifications } from '../useGlobalUpscaleNotifications';

const buildStore = () =>
  configureStore({
    reducer: { upscale: upscaleReducer },
  });

type Store = ReturnType<typeof buildStore>;

let store: Store;

beforeEach(() => {
  store = buildStore();
  mockEnqueue.mockReset();
  mockClose.mockReset();
  mockNavigate.mockReset();
});

const Harness = () => {
  useGlobalUpscaleNotifications();
  return null;
};

const wrap = (ui: ReactNode) => (
  <Provider store={store}>{ui}</Provider>
);

describe('useGlobalUpscaleNotifications', () => {
  it('fires success snackbar with an action button when projectId is present', () => {
    const { rerender } = render(wrap(<Harness />));
    act(() => {
      store.dispatch(
        recordCompletion({
          designId: 'd-1',
          projectId: 'p-42',
          kind: 'success',
          ts: 1,
        }),
      );
    });
    rerender(wrap(<Harness />));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const [, opts] = mockEnqueue.mock.calls[0];
    expect(opts.variant).toBe('success');
    expect(opts.action).toBeTypeOf('function');

    // Invoke the action factory → React element with onClick. We render it,
    // click it, and assert the navigate + close calls.
    const actionEl = opts.action('snack-id');
    const { getByRole } = render(actionEl);
    fireEvent.click(getByRole('button'));
    expect(mockNavigate).toHaveBeenCalledWith('/designs/p-42');
    expect(mockClose).toHaveBeenCalledWith('snack-id');
  });

  it('fires success snackbar WITHOUT an action when projectId is null', () => {
    const { rerender } = render(wrap(<Harness />));
    act(() => {
      store.dispatch(
        recordCompletion({
          designId: 'd-1',
          projectId: null,
          kind: 'success',
          ts: 2,
        }),
      );
    });
    rerender(wrap(<Harness />));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const [, opts] = mockEnqueue.mock.calls[0];
    expect(opts.action).toBeUndefined();
  });

  it('deduplicates by ts (same ts → at most one snackbar)', () => {
    const { rerender } = render(wrap(<Harness />));
    act(() => {
      store.dispatch(
        recordCompletion({
          designId: 'd-1',
          projectId: 'p-1',
          kind: 'success',
          ts: 7,
        }),
      );
    });
    rerender(wrap(<Harness />));
    // Force a re-render with the same lastCompletion in the store.
    rerender(wrap(<Harness />));
    rerender(wrap(<Harness />));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
  });

  it('fires error snackbar for kind=error (no action)', () => {
    const { rerender } = render(wrap(<Harness />));
    act(() => {
      store.dispatch(
        recordCompletion({
          designId: 'd-1',
          projectId: 'p-1',
          kind: 'error',
          reason: 'trigger_failed',
          ts: 11,
        }),
      );
    });
    rerender(wrap(<Harness />));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const [, opts] = mockEnqueue.mock.calls[0];
    expect(opts.variant).toBe('error');
  });

  it('fires warning snackbar for timeout reason', () => {
    const { rerender } = render(wrap(<Harness />));
    act(() => {
      store.dispatch(
        recordCompletion({
          designId: 'd-1',
          projectId: 'p-1',
          kind: 'error',
          reason: 'timeout',
          ts: 12,
        }),
      );
    });
    rerender(wrap(<Harness />));

    expect(mockEnqueue).toHaveBeenCalledTimes(1);
    const [, opts] = mockEnqueue.mock.calls[0];
    expect(opts.variant).toBe('warning');
  });
});
