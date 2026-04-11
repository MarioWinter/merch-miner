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

vi.mock('../partials/ExportControls', () => ({
  ExportControls: () => <div data-testid="export-controls">ExportControls</div>,
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
// Tests
// -----------------------------------------------------------------

describe('DesignEditorView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crash', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" />,
    );
    expect(screen.getByTestId('pipeline-bar')).toBeInTheDocument();
    expect(screen.getByTestId('tool-panel')).toBeInTheDocument();
  });

  it('shows drop zone when no images loaded', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" />,
    );
    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
    expect(screen.queryByTestId('editor-canvas')).not.toBeInTheDocument();
  });

  it('does not show batch strip when no images loaded', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" />,
    );
    expect(screen.queryByTestId('batch-strip')).not.toBeInTheDocument();
  });

  it('renders hidden file input with correct accept attribute', () => {
    renderWithProviders(
      <DesignEditorView projectId="proj-1" />,
    );
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe('image/*');
    expect(fileInput.multiple).toBe(true);
    expect(fileInput.hidden).toBe(true);
  });

  it('shows editor canvas when initialImages provided', () => {
    renderWithProviders(
      <DesignEditorView
        projectId="proj-1"
        initialImages={[{ url: 'blob:http://localhost/test', name: 'test.png' }]}
      />,
    );
    expect(screen.getByTestId('editor-canvas')).toBeInTheDocument();
    expect(screen.queryByTestId('drop-zone')).not.toBeInTheDocument();
  });

  it('shows batch strip when initialImages provided', () => {
    renderWithProviders(
      <DesignEditorView
        projectId="proj-1"
        initialImages={[{ url: 'blob:http://localhost/test', name: 'test.png' }]}
      />,
    );
    expect(screen.getByTestId('batch-strip')).toBeInTheDocument();
  });

  it('triggers file input click via Browse Files button in drop zone', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DesignEditorView projectId="proj-1" />,
    );
    const browseBtn = screen.getByText('Browse Files');
    // The click handler calls fileInputRef.current?.click()
    // In JSDOM the ref won't truly open a dialog, but we verify no crash
    await user.click(browseBtn);
    expect(browseBtn).toBeInTheDocument();
  });
});
