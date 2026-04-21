import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { DesignAsset, GalleryListResponse } from '../types';

// ---------------------------------------------------------------------------
// Playwright smoke spec (manual / follow-up)
// ---------------------------------------------------------------------------
// H5 — Delete Action E2E (executed outside Vitest):
//   1. Login + upload one design on /publish
//   2. Hover card → click 3-dot menu → Delete
//   3. ConfirmDialog opens — click "Delete"
//   4. Assert: card disappears + "Design deleted" snackbar renders
//   5. Reload — design stays gone (server-side confirmation)
// The jsdom tests below exercise the wiring (mutation called, snackbars fire,
// optimistic revert on 500). The Playwright pass owns real network + render.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RTK Query mocks
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

const deleteMock = vi.fn();
let deleteUnwrap: () => Promise<unknown> = () => Promise.resolve(undefined);

const uploadMock = vi.fn();
const updateMock = vi.fn();
const duplicateMock = vi.fn();

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useListGalleryQuery: () => galleryState,
    useDeleteDesignMutation: () => [
      (id: string) => {
        deleteMock(id);
        return { unwrap: () => deleteUnwrap() };
      },
      { isLoading: false },
    ],
    useUploadDesignMutation: () => [
      (body: unknown) => {
        uploadMock(body);
        return { unwrap: () => Promise.resolve({}) };
      },
      { isLoading: false },
    ],
    useUpdateDesignMutation: () => [
      (args: unknown) => {
        updateMock(args);
        return { unwrap: () => Promise.resolve({}) };
      },
      { isLoading: false },
    ],
    useDuplicateDesignMutation: () => [
      (id: string) => {
        duplicateMock(id);
        return { unwrap: () => Promise.resolve(makeDesign({ id: 'd-new' })) };
      },
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
  };
});

// Snackbar spy — notistack's enqueueSnackbar is what we assert against.
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
// Tests
// ---------------------------------------------------------------------------

describe('PublishView — Delete single (H5, AC-64, EC-29)', () => {
  beforeEach(() => {
    deleteMock.mockClear();
    snackbarMock.mockClear();
    uploadMock.mockClear();
    updateMock.mockClear();
    duplicateMock.mockClear();
    galleryState.data = {
      count: 1,
      next: null,
      previous: null,
      results: [makeDesign()],
    };
    galleryState.isLoading = false;
    deleteUnwrap = () => Promise.resolve(undefined);
  });

  it('opens menu → Delete → Confirm → calls deleteDesign with id and shows success snackbar', async () => {
    renderWithProviders(<PublishView />);

    // Open the 3-dot menu on the first (and only) card.
    const img = await screen.findByAltText('shirt.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    const menuButton = within(card).getByRole('button', { name: /open card menu/i });
    fireEvent.click(menuButton);

    // Click Delete in the menu.
    const deleteItem = await screen.findByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteItem);

    // ConfirmDialog appears — click the destructive button.
    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('d-1'));
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/deleted/i),
        expect.objectContaining({ variant: 'success' }),
      ),
    );
  });

  it('shows error snackbar when deleteDesign rejects 500 (EC-29 optimistic revert)', async () => {
    // Server-side failure — the RTK mutation rejects. PublishView catches the
    // rejection, leaves the dialog open (no optimistic removal happens at the
    // view layer, the RTK cache stays intact), and surfaces an error snackbar.
    deleteUnwrap = () => Promise.reject(new Error('boom'));

    renderWithProviders(<PublishView />);

    const img = await screen.findByAltText('shirt.png');
    const card = img.closest('[data-design-id]') as HTMLElement;
    const menuButton = within(card).getByRole('button', { name: /open card menu/i });
    fireEvent.click(menuButton);

    const deleteItem = await screen.findByRole('menuitem', { name: /^delete$/i });
    fireEvent.click(deleteItem);

    const confirmBtn = await screen.findByRole('button', { name: /^delete$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('d-1'));
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/failed/i),
        expect.objectContaining({ variant: 'error' }),
      ),
    );

    // Gallery data untouched — the card is still rendered because RTK cache
    // did not flip on a server error.
    expect(screen.getByAltText('shirt.png')).toBeInTheDocument();
  });
});
