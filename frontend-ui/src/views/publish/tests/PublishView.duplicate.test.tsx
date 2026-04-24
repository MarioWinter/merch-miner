import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { DesignAsset, GalleryListResponse } from '../types';

// ---------------------------------------------------------------------------
// Playwright smoke spec (manual / follow-up)
// ---------------------------------------------------------------------------
// H6 — Duplicate Action E2E (executed outside Vitest):
//   1. Login + open /publish with at least one uploaded design
//   2. Hover card → 3-dot menu → Duplicate
//   3. Assert: a new card with the same file name appears (server-suffixed key)
//   4. Assert: "Design duplicated" snackbar
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeDesign = (overrides: Partial<DesignAsset> = {}): DesignAsset => ({
  id: 'd-1',
  workspace: 'ws-1',
  file_name: 'shirt.png',
  file_url: 'https://cdn.example/shirt.png',
  source: 'upload',
  source_file_id: '',
  thumbnail_url: '',
  dimensions: { width: 1000, height: 1000 },
  file_size: 1024,
  tags: [],
  listing: null,
  idea: null,
  niche: null,
  collection: null,
  round: 1,
  created_by: 'user-1',
  created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const galleryState: { data: GalleryListResponse | undefined; isLoading: boolean } = {
  data: {
    count: 1,
    next: null,
    previous: null,
    results: [makeDesign()],
  },
  isLoading: false,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const duplicateMock = vi.fn();
// Each test sets `duplicateUnwrap` to a resolving/rejecting thunk before it
// clicks the menu item. Default: resolve with a fresh asset.
let duplicateUnwrap: () => Promise<unknown> = () =>
  Promise.resolve(makeDesign({ id: 'd-new', file_name: 'shirt-copy.png' }));

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useListGalleryQuery: () => galleryState,
    useDuplicateDesignMutation: () => [
      (id: string) => {
        duplicateMock(id);
        return { unwrap: () => duplicateUnwrap() };
      },
      { isLoading: false },
    ],
    useDeleteDesignMutation: () => [
      () => ({ unwrap: () => Promise.resolve(undefined) }),
      { isLoading: false },
    ],
    useUploadDesignMutation: () => [
      () => ({ unwrap: () => Promise.resolve({}) }),
      { isLoading: false },
    ],
    useUpdateDesignMutation: () => [
      () => ({ unwrap: () => Promise.resolve({}) }),
      { isLoading: false },
    ],
    useGetCollectionTreeQuery: () => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useListCollectionsQuery: () => ({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useCreateCollectionMutation: () => [
      () => ({ unwrap: () => Promise.resolve({ id: 'new' }) }),
      { isLoading: false },
    ],
    useMoveAssetsMutation: () => [
      () => ({ unwrap: () => Promise.resolve(undefined) }),
      { isLoading: false },
    ],
    useImportDriveMutation: () => [
      () => ({ unwrap: () => Promise.resolve({ imported_count: 0 }) }),
      { isLoading: false },
    ],
    useListExportHistoryQuery: () => ({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    usePreviewExportMutation: () => [
      () => ({ unwrap: () => Promise.resolve({ total_designs: 0, ready_rows: 0, skipped: [], warnings: [] }) }),
      { isLoading: false },
    ],
    useRunExportMutation: () => [
      () => ({ unwrap: () => Promise.resolve({ blob: new Blob(), filename: 'e.zip' }) }),
      { isLoading: false },
    ],
  };
});

const snackbarMock = vi.fn();
vi.mock('notistack', async (importOriginal) => {
  const actual = await importOriginal<typeof import('notistack')>();
  return {
    ...actual,
    useSnackbar: () => ({
      enqueueSnackbar: snackbarMock,
      closeSnackbar: vi.fn(),
    }),
  };
});

import PublishView from '../PublishView';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const openMenuAndClickDuplicate = async () => {
  const img = await screen.findByAltText('shirt.png');
  const card = img.closest('[data-design-id]') as HTMLElement;
  const menuButton = within(card).getByRole('button', { name: /open card menu/i });
  fireEvent.click(menuButton);

  const dupItem = await screen.findByRole('menuitem', { name: /^duplicate$/i });
  fireEvent.click(dupItem);
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PublishView — Duplicate single (H6, AC-66, EC-27, EC-30)', () => {
  beforeEach(() => {
    duplicateMock.mockClear();
    snackbarMock.mockClear();
    duplicateUnwrap = () =>
      Promise.resolve(makeDesign({ id: 'd-new', file_name: 'shirt-copy.png' }));
  });

  it('menu Duplicate → calls duplicateDesign with id and shows success snackbar (AC-66)', async () => {
    renderWithProviders(<PublishView />);

    await openMenuAndClickDuplicate();

    await waitFor(() => expect(duplicateMock).toHaveBeenCalledWith('d-1'));
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/duplicated/i),
        expect.objectContaining({ variant: 'success' }),
      ),
    );
  });

  it('shows error snackbar when duplicate mutation rejects 500 (EC-30 atomic rollback)', async () => {
    // Backend raises ValidationError → surfaces as a 500-class rejection with
    // no resolved asset. PublishView should swallow the rejection, keep the
    // card in place (no optimistic insert), and notify the user.
    const err = Object.assign(new Error('internal'), { status: 500 });
    duplicateUnwrap = () => Promise.reject(err);

    renderWithProviders(<PublishView />);

    await openMenuAndClickDuplicate();

    await waitFor(() => expect(duplicateMock).toHaveBeenCalledWith('d-1'));
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/failed/i),
        expect.objectContaining({ variant: 'error' }),
      ),
    );
  });

  it('shows specific "no longer exists" snackbar on 404 (EC-27 missing source)', async () => {
    // Cross-workspace or already-deleted source: backend returns 404. The
    // handler distinguishes this case so the user gets actionable copy
    // instead of a generic failure message.
    const err = Object.assign(new Error('not found'), { status: 404 });
    duplicateUnwrap = () => Promise.reject(err);

    renderWithProviders(<PublishView />);

    await openMenuAndClickDuplicate();

    await waitFor(() => expect(duplicateMock).toHaveBeenCalledWith('d-1'));
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/no longer exists/i),
        expect.objectContaining({ variant: 'error' }),
      ),
    );
  });
});
