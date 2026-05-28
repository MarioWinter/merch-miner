import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../../../utils/test-utils';
import DesignEditorView from '../DesignEditorView';

// -----------------------------------------------------------------
// Mocks — heavy component, mock all child partials + hooks
// -----------------------------------------------------------------

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: React.ReactNode }) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Image: () => <div data-testid="konva-image" />,
}));

// PROJ-30 T3.24 — keep test layout in desktop mode so the 280px ToolPanel
// renders inline (mobile path hides it behind a FAB drawer).
vi.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    isPhoneTiny: false,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  }),
}));

vi.mock('../partials/PipelineBar', () => ({
  PipelineBar: () => <div data-testid="pipeline-bar">PipelineBar</div>,
}));

vi.mock('../partials/ToolPanel', () => ({
  ToolPanel: () => <div data-testid="tool-panel">ToolPanel</div>,
}));

vi.mock('../partials/EditorCanvas', () => ({
  EditorCanvas: () => <div data-testid="editor-canvas">EditorCanvas</div>,
}));

vi.mock('../partials/BatchThumbnailStrip', () => ({
  BatchThumbnailStrip: () => <div data-testid="batch-strip">BatchThumbnailStrip</div>,
}));

vi.mock('../partials/UnifiedBottomBar', () => ({
  UnifiedBottomBar: () => <div data-testid="unified-bottom-bar">UnifiedBottomBar</div>,
}));

vi.mock('../partials/ExportDialog', () => ({
  ExportDialog: () => null,
}));

vi.mock('../partials/DropZone', () => ({
  DropZone: ({ onBrowse }: { onBrowse: () => void }) => (
    <div data-testid="drop-zone">
      <button onClick={onBrowse}>Browse Files</button>
    </div>
  ),
}));

vi.mock('../partials/CloudManagerDialog', () => ({
  CloudManagerDialog: () => null,
}));

vi.mock('../partials/JobPollerManager', () => ({
  JobPollerManager: () => null,
}));

vi.mock('@/components/ConfirmDialog', () => ({
  default: () => null,
}));

// Mock hooks
const mockStartProcessing = vi.fn();
const mockProcessBatch = vi.fn().mockResolvedValue([]);
const mockCancelProcessing = vi.fn();
const mockUploadFiles = vi.fn();

vi.mock('../hooks/useProcessing', () => ({
  useProcessing: () => ({
    startProcessing: mockStartProcessing,
    jobs: [],
    onJobUpdate: vi.fn(),
  }),
}));

vi.mock('../hooks/useClientProcessing', () => ({
  useClientProcessing: () => ({
    processBatch: mockProcessBatch,
    isProcessing: false,
    progress: null,
    cancel: mockCancelProcessing,
  }),
}));

vi.mock('../hooks/useLivePreview', () => ({
  useLivePreview: () => ({
    previewUrl: null,
    isProcessing: false,
  }),
}));

vi.mock('../hooks/useEditorUpload', () => ({
  useEditorUpload: () => ({
    uploadFiles: mockUploadFiles,
  }),
}));

vi.mock('../hooks/useUndoRedo', () => ({
  default: () => ({
    pushSnapshot: vi.fn(),
    undo: vi.fn().mockReturnValue(null),
    redo: vi.fn().mockReturnValue(null),
    canUndo: false,
    canRedo: false,
  }),
}));

vi.mock('../hooks/usePicaUpscale', () => ({
  PICA_THRESHOLD_PX: 3000,
}));

vi.mock('@/store/designSlice', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/store/designSlice')>();
  return {
    ...actual,
    useGetProjectBoardQuery: () => ({ data: null }),
    useDeleteDesignMutation: () => [vi.fn(), { isLoading: false }],
    useSaveProcessedImageMutation: () => [vi.fn()],
    useDeleteDesignVersionMutation: () => [vi.fn()],
    useGetDesignsByIdsQuery: () => ({ data: null, isLoading: false }),
  };
});

// -----------------------------------------------------------------
// Test helpers — Phase 8 hoisted editorState shape
// -----------------------------------------------------------------

const makeEditorState = (overrides: Partial<Record<string, unknown>> = {}) => ({
  batchImages: [],
  setBatchImages: vi.fn(),
  currentImageIndex: 0,
  setCurrentImageIndex: vi.fn(),
  currentImage: null,
  hasImages: false,
  fileInputRef: { current: null },
  preloadIds: [],
  undoRedo: { canUndo: false, canRedo: false, undo: vi.fn(), redo: vi.fn(), pushSnapshot: vi.fn() },
  selection: { selectedIndices: new Set<number>(), toggle: vi.fn(), clear: vi.fn(), selectAll: vi.fn() },
  isDeletingDesign: false,
  deleteConfirmIndex: null,
  loadImageMeta: vi.fn(),
  saveProcessedImage: vi.fn(),
  handleFilesAdded: vi.fn(),
  handleBrowseClick: vi.fn(),
  handleFileInputChange: vi.fn(),
  handleRemoveImage: vi.fn(),
  handleRemoveAll: vi.fn(),
  handleDeleteFromServer: vi.fn(),
  handleDeleteConfirm: vi.fn(),
  handleDeleteCancel: vi.fn(),
  handleDeleteVersion: vi.fn(),
  handleUndo: vi.fn(),
  handleRedo: vi.fn(),
  handleDrop: vi.fn(),
  handleDragOver: vi.fn(),
  getBatchFile: vi.fn(),
  ALWAYS_SERVER_TOOLS: [] as string[],
  ...overrides,
}) as unknown as React.ComponentProps<typeof DesignEditorView>['editorState'];

const defaultPipelineState = {
  activePipeline: [],
  setActivePipeline: vi.fn(),
};

// -----------------------------------------------------------------
// Tests
// -----------------------------------------------------------------

describe('DesignEditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crash', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" editorState={makeEditorState()} {...defaultPipelineState} />,
    );
    expect(screen.getByTestId('pipeline-bar')).toBeInTheDocument();
    expect(screen.getByTestId('tool-panel')).toBeInTheDocument();
  });

  it('shows drop zone when no images loaded', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" editorState={makeEditorState()} {...defaultPipelineState} />,
    );
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-canvas')).not.toBeInTheDocument();
  });

  it('does not show batch strip when no images loaded', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" editorState={makeEditorState()} {...defaultPipelineState} />,
    );
    expect(screen.queryByTestId('batch-strip')).not.toBeInTheDocument();
  });

  it('renders hidden file input with correct accept attribute', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" editorState={makeEditorState()} {...defaultPipelineState} />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('image/*');
    expect(fileInput.multiple).toBe(true);
    expect(fileInput.hidden).toBe(true);
  });

  it('shows editor canvas when editorBatch provided', () => {
    renderWithProviders(
      <DesignEditorView
        projectId="proj-1"
        editorBatch={[{ id: 'b1', url: 'blob:http://localhost/test', name: 'test.png' }]}
        editorState={makeEditorState({ hasImages: true, batchImages: [{ id: 'b1', file: null, previewUrl: 'blob:http://localhost/test', name: 'test.png', status: 'idle' as const }], currentImage: { id: 'b1', file: null, previewUrl: 'blob:http://localhost/test', name: 'test.png', status: 'idle' as const } })}
        {...defaultPipelineState}
      />,
    );
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
  });

  it('shows batch strip when editorBatch provided', () => {
    renderWithProviders(
      <DesignEditorView
        projectId="proj-1"
        editorBatch={[{ id: 'b1', url: 'blob:http://localhost/test', name: 'test.png' }]}
        editorState={makeEditorState({ hasImages: true, batchImages: [{ id: 'b1', file: null, previewUrl: 'blob:http://localhost/test', name: 'test.png', status: 'idle' as const }], currentImage: { id: 'b1', file: null, previewUrl: 'blob:http://localhost/test', name: 'test.png', status: 'idle' as const } })}
        {...defaultPipelineState}
      />,
    );
    expect(screen.getByTestId('batch-strip')).toBeInTheDocument();
  });

  it('triggers file input click via Browse Files button in drop zone', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DesignEditorView projectId="proj-1" editorState={makeEditorState()} {...defaultPipelineState} />,
    );
    const browseBtn = screen.getByText('Browse Files');
    // The click handler calls fileInputRef.current?.click()
    // In JSDOM the ref won't truly open a dialog, but we verify no crash
    await user.click(browseBtn);
    expect(browseBtn).toBeInTheDocument();
  });
});
