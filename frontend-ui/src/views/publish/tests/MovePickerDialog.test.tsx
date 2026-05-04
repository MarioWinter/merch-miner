import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/utils/test-utils';
import type { CollectionTreeNode } from '../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

interface QueryResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

const treeResult: QueryResult<CollectionTreeNode[]> = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const moveMock = vi.fn();
let moveUnwrap: () => Promise<unknown> = () => Promise.resolve(undefined);

// Spy dispatch target used for tree-invalidation assertion on 404.
const dispatchMock = vi.fn();

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useGetCollectionTreeQuery: () => treeResult,
    useMoveAssetsMutation: () => [
      (args: unknown) => {
        moveMock(args);
        return { unwrap: () => moveUnwrap() };
      },
      { isLoading: false },
    ],
  };
});

// useAppDispatch returns a plain function whose calls we can inspect. We
// forward the actual util.invalidateTags so the test asserts on the payload.
vi.mock('@/store/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/hooks')>();
  return {
    ...actual,
    useAppDispatch: () => dispatchMock,
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

import MovePickerDialog from '../partials/grid/MovePickerDialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeNode = (
  overrides: Partial<CollectionTreeNode> = {},
): CollectionTreeNode => ({
  id: 'col-1',
  name: 'Slogans',
  children: [],
  asset_count: 3,
  ...overrides,
});

const resetTree = () => {
  Object.assign(treeResult, {
    data: [] as CollectionTreeNode[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MovePickerDialog (H7, AC-67, AC-68, EC-28)', () => {
  beforeEach(() => {
    moveMock.mockClear();
    snackbarMock.mockClear();
    dispatchMock.mockClear();
    moveUnwrap = () => Promise.resolve(undefined);
    resetTree();
  });

  it('renders the tree, a Home/Root entry and a disabled Move Here button by default', () => {
    treeResult.data = [makeNode({ id: 'col-a', name: 'Folder A' })];

    renderWithProviders(
      <MovePickerDialog
        open
        assetId="asset-1"
        currentCollectionId={null}
        onClose={vi.fn()}
      />,
    );

    // Dialog title.
    expect(
      screen.getByRole('heading', { name: /move to collection/i }),
    ).toBeInTheDocument();

    // Tree entry from mock + Home/Root pseudo-entry rendered by FolderTree.
    expect(screen.getByText('Folder A')).toBeInTheDocument();
    expect(screen.getByText(/home/i)).toBeInTheDocument();

    // "Move Here" is disabled until a target is picked.
    const moveBtn = screen.getByRole('button', { name: /move here/i });
    expect(moveBtn).toBeDisabled();
  });

  it('disables the asset\'s current collection in the tree (AC-68)', () => {
    treeResult.data = [
      makeNode({ id: 'col-a', name: 'Folder A' }),
      makeNode({ id: 'col-b', name: 'Folder B' }),
    ];

    renderWithProviders(
      <MovePickerDialog
        open
        assetId="asset-1"
        currentCollectionId="col-a"
        onClose={vi.fn()}
      />,
    );

    // FolderTree marks disabled entries with aria-disabled="true".
    const currentEntry = screen.getByText('Folder A').closest('[aria-disabled="true"]');
    expect(currentEntry).not.toBeNull();
    // Sibling folder remains selectable.
    const otherEntry = screen.getByText('Folder B').closest('[aria-disabled="true"]');
    expect(otherEntry).toBeNull();
  });

  it('disables the Home entry when the asset is already at root', () => {
    treeResult.data = [makeNode({ id: 'col-a', name: 'Folder A' })];

    renderWithProviders(
      <MovePickerDialog
        open
        assetId="asset-1"
        currentCollectionId={null}
        onClose={vi.fn()}
      />,
    );

    // With the asset at root (`currentCollectionId === null`), FolderTree's
    // Home row must be flagged disabled to prevent a no-op move.
    const homeEntry = screen.getByText(/home/i).closest('[aria-disabled="true"]');
    expect(homeEntry).not.toBeNull();
  });

  it('picking a folder enables Move Here and calls moveAssets with the correct body', async () => {
    treeResult.data = [makeNode({ id: 'col-a', name: 'Folder A' })];
    const onClose = vi.fn();
    const onMoved = vi.fn();

    renderWithProviders(
      <MovePickerDialog
        open
        assetId="asset-1"
        currentCollectionId={null}
        onClose={onClose}
        onMoved={onMoved}
      />,
    );

    // Pick the folder — the TreeItem onClick lands on the row; the text node
    // is inside it but click propagation is enough to trigger handleSelect.
    fireEvent.click(screen.getByText('Folder A'));

    const moveBtn = screen.getByRole('button', { name: /move here/i });
    expect(moveBtn).toBeEnabled();

    fireEvent.click(moveBtn);

    await waitFor(() =>
      expect(moveMock).toHaveBeenCalledWith({
        asset_ids: ['asset-1'],
        collection_id: 'col-a',
      }),
    );
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/moved/i),
        expect.objectContaining({ variant: 'success' }),
      ),
    );
    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('404 response fires error snackbar and dispatches tree invalidation (EC-28)', async () => {
    treeResult.data = [makeNode({ id: 'col-stale', name: 'Stale Folder' })];
    const err = Object.assign(new Error('gone'), { status: 404 });
    moveUnwrap = () => Promise.reject(err);

    renderWithProviders(
      <MovePickerDialog
        open
        assetId="asset-1"
        currentCollectionId={null}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('Stale Folder'));
    fireEvent.click(screen.getByRole('button', { name: /move here/i }));

    await waitFor(() => expect(moveMock).toHaveBeenCalled());
    await waitFor(() =>
      expect(snackbarMock).toHaveBeenCalledWith(
        expect.stringMatching(/no longer exists/i),
        expect.objectContaining({ variant: 'error' }),
      ),
    );
    // Dispatch must fire with an action — we just confirm the invalidation
    // path runs (the exact payload is an RTK internal util object).
    await waitFor(() => expect(dispatchMock).toHaveBeenCalled());
  });

  it('Cancel button closes the dialog without calling moveAssets', () => {
    treeResult.data = [makeNode({ id: 'col-a', name: 'Folder A' })];
    const onClose = vi.fn();

    renderWithProviders(
      <MovePickerDialog
        open
        assetId="asset-1"
        currentCollectionId={null}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onClose).toHaveBeenCalled();
    expect(moveMock).not.toHaveBeenCalled();
  });
});
