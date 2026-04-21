import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/utils/test-utils';
import type { CollectionTreeNode, DesignCollection } from '../types';

// ---------------------------------------------------------------------------
// Mocks — keep the dialog isolated from RTK Query network wiring.
// We stub only the hooks CollectionsDialog consumes (tree, list, create).
// Other exports survive so downstream imports (e.g. `publishApi`) still load.
// ---------------------------------------------------------------------------

type QueryResult<T> = {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

const treeResult: QueryResult<CollectionTreeNode[]> = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const foldersResult: QueryResult<DesignCollection[]> = {
  data: [],
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
};

const createMock = vi.fn();
const unwrapMock = vi.fn().mockResolvedValue({ id: 'new-id' });
const createHook = vi.fn(() => [
  // Mutation trigger returns a thenable with an `unwrap` method (RTK shape).
  (args: { name: string; parent: string | null }) => {
    createMock(args);
    return { unwrap: unwrapMock };
  },
  { isLoading: false },
]);

vi.mock('@/store/publishSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/publishSlice')>();
  return {
    ...actual,
    useGetCollectionTreeQuery: () => treeResult,
    useListCollectionsQuery: () => foldersResult,
    useCreateCollectionMutation: () => createHook(),
  };
});

import CollectionsDialog from '../partials/collections/CollectionsDialog';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeNode = (
  overrides: Partial<CollectionTreeNode> = {},
): CollectionTreeNode => ({
  id: 'root-1',
  name: 'Root Folder',
  children: [],
  asset_count: 0,
  ...overrides,
});

const makeFolder = (
  overrides: Partial<DesignCollection> = {},
): DesignCollection => ({
  id: 'folder-1',
  name: 'Slogans',
  parent: null,
  position: 0,
  child_count: 0,
  asset_count: 3,
  created_by: 'user-1',
  created_at: '2026-04-10T00:00:00Z',
  ...overrides,
});

const resetResults = () => {
  Object.assign(treeResult, {
    data: [] as CollectionTreeNode[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  Object.assign(foldersResult, {
    data: [] as DesignCollection[],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollectionsDialog', () => {
  beforeEach(() => {
    resetResults();
    createMock.mockClear();
    unwrapMock.mockClear();
    createHook.mockClear();
  });

  it('renders the tree + grid split layout when opened', () => {
    treeResult.data = [
      makeNode({ id: 't-1', name: 'Tree Folder A' }),
    ];
    foldersResult.data = [makeFolder({ id: 'g-1', name: 'Grid Folder A' })];

    renderWithProviders(
      <CollectionsDialog open onClose={vi.fn()} onOpenFolder={vi.fn()} />,
    );

    // Header title (DialogTitle renders as h2; inner span carries the text).
    expect(
      screen.getByRole('heading', { name: /collections/i, level: 2 }),
    ).toBeInTheDocument();

    // Left pane — FolderTree shows the tree entry.
    expect(screen.getByText('Tree Folder A')).toBeInTheDocument();

    // Right pane — FolderGrid shows the folder card labelled by name.
    expect(
      screen.getByRole('button', { name: /grid folder a/i }),
    ).toBeInTheDocument();

    // AddFolder card is always present in the grid.
    expect(
      screen.getByRole('button', { name: /add folder/i }),
    ).toBeInTheDocument();
  });

  it('FolderTree click selects the node (Open Folder dispatches its id)', () => {
    treeResult.data = [
      makeNode({ id: 'node-42', name: 'Tree Target' }),
    ];
    const onOpenFolder = vi.fn();

    renderWithProviders(
      <CollectionsDialog open onClose={vi.fn()} onOpenFolder={onOpenFolder} />,
    );

    // Click the tree node — CollectionsDialog stores `selectedId` internally.
    fireEvent.click(screen.getByText('Tree Target'));

    // Clicking "Open Folder" forwards the selected id to the parent callback.
    fireEvent.click(screen.getByRole('button', { name: /open folder/i }));
    expect(onOpenFolder).toHaveBeenCalledWith('node-42');
  });

  it('"Add Folder" card opens inline rename and submits the new name via create mutation', async () => {
    renderWithProviders(
      <CollectionsDialog open onClose={vi.fn()} onOpenFolder={vi.fn()} />,
    );

    // Click the Add card to enter edit mode — placeholder becomes visible.
    fireEvent.click(screen.getByRole('button', { name: /add folder/i }));
    const input = await screen.findByPlaceholderText(/folder name/i);
    expect(input).toBeInTheDocument();

    // Type and press Enter — handleSubmit calls onAdd → createCollection.
    await userEvent.type(input, 'New Batch');
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(createMock).toHaveBeenCalledWith({
      name: 'New Batch',
      parent: null,
    });
  });

  it('closes via the header close button (onClose callback)', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <CollectionsDialog open onClose={onClose} onOpenFolder={vi.fn()} />,
    );

    // The header IconButton uses aria-label "Close".
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
