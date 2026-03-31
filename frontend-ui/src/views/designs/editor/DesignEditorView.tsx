import { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { COLORS, DURATION, EASING } from '@/style/constants';
import { PipelineBar } from './partials/PipelineBar';
import { ToolPanel } from './partials/ToolPanel';
import { EditorCanvas } from './partials/EditorCanvas';
import { BatchThumbnailStrip } from './partials/BatchThumbnailStrip';
import { ExportControls } from './partials/ExportControls';
import { DropZone } from './partials/DropZone';
import { useProcessing } from './hooks/useProcessing';
import { JobPollerManager } from './partials/JobPollerManager';
import type { PipelineTool, BatchImage, CanvasToolType, ExportSettings } from './types';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface DesignEditorViewProps {
  /** Images passed directly from canvas tab (local blob URLs without designId) */
  initialImages?: Array<{ url: string; name: string }>;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const TOOL_PANEL_WIDTH = 280;
const PIPELINE_BAR_HEIGHT = 48;
const PIPELINE_BAR_EXPANDED_HEIGHT = 200;
const THUMBNAIL_STRIP_HEIGHT = 80;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const EditorRoot = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  overflow: 'hidden',
  position: 'relative',
});

const PipelineBarWrapper = styled(Box, {
  shouldForwardProp: (p) => p !== '$expanded',
})<{ $expanded: boolean }>(({ theme, $expanded }) => ({
  height: $expanded ? PIPELINE_BAR_EXPANDED_HEIGHT : PIPELINE_BAR_HEIGHT,
  flexShrink: 0,
  borderBottom: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.inkPaper,
  transition: `height ${DURATION.default}ms ${EASING.standard}`,
  overflow: 'hidden',
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const ContentRow = styled(Box)({
  display: 'flex',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
});

const ToolPanelWrapper = styled(Box)(({ theme }) => ({
  width: TOOL_PANEL_WIDTH,
  flexShrink: 0,
  borderRight: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.inkPaper,
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarWidth: 'thin',
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

const CanvasArea = styled(Box)({
  flex: 1,
  minWidth: 0,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
});

const CanvasMain = styled(Box)(({ theme }) => ({
  flex: 1,
  minHeight: 0,
  position: 'relative',
  backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.ash,
  }),
}));

const StripWrapper = styled(Box)(({ theme }) => ({
  height: THUMBNAIL_STRIP_HEIGHT,
  flexShrink: 0,
  display: 'flex',
  borderTop: '1px solid',
  borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.inkPaper,
  ...theme.applyStyles('light', {
    backgroundColor: COLORS.white,
  }),
}));

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const DesignEditorView = ({ initialImages }: DesignEditorViewProps) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  // Pipeline state
  const [pipelineExpanded, setPipelineExpanded] = useState(false);
  const [activePipeline, setActivePipeline] = useState<PipelineTool[]>([]);

  // Batch state — seed with initialImages from canvas tab on first render
  const [batchImages, setBatchImages] = useState<BatchImage[]>(() => {
    if (!initialImages || initialImages.length === 0) return [];
    return initialImages.map((img) => ({
      id: crypto.randomUUID(),
      file: null,
      previewUrl: img.url,
      name: img.name,
      status: 'idle' as const,
    }));
  });
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Canvas tool state
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasToolType>('move');

  // Export controls visibility
  const [showExport, setShowExport] = useState(false);

  // Processing hook
  const { jobs, onJobUpdate } = useProcessing();

  // File input ref for "Browse Files"
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preloaded design IDs from URL (supports both ?designs= and ?images= params)
  const preloadIds = (
    searchParams.get('designs') ?? searchParams.get('images') ?? ''
  ).split(',').filter(Boolean);

  const hasImages = batchImages.length > 0;
  const currentImage = hasImages ? batchImages[currentImageIndex] : null;

  // --- Handlers ---

  const handleFilesAdded = useCallback((files: File[]) => {
    const newImages: BatchImage[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      status: 'idle' as const,
      fileSize: file.size,
    }));
    setBatchImages((prev) => [...prev, ...newImages]);
    if (batchImages.length === 0) {
      setCurrentImageIndex(0);
    }
  }, [batchImages.length]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleFilesAdded(Array.from(files));
      }
      e.target.value = '';
    },
    [handleFilesAdded],
  );

  const handleRemoveImage = useCallback((index: number) => {
    setBatchImages((prev) => {
      const next = [...prev];
      const removed = next.splice(index, 1)[0];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
    setCurrentImageIndex((prev) => Math.min(prev, Math.max(0, batchImages.length - 2)));
  }, [batchImages.length]);

  const handleRemoveAll = useCallback(() => {
    batchImages.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setBatchImages([]);
    setCurrentImageIndex(0);
  }, [batchImages]);

  const handleAddTool = useCallback((tool: PipelineTool) => {
    setActivePipeline((prev) => [...prev, tool]);
  }, []);

  const handleRemoveTool = useCallback((toolId: string) => {
    setActivePipeline((prev) => prev.filter((t) => t.id !== toolId));
  }, []);

  const handleReorderPipeline = useCallback((tools: PipelineTool[]) => {
    setActivePipeline(tools);
  }, []);

  const handleToggleTool = useCallback((toolId: string) => {
    setActivePipeline((prev) =>
      prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t)),
    );
  }, []);

  // --- Export handlers ---

  const handleDownloadCurrent = useCallback((settings: ExportSettings) => {
    if (!currentImage) return;
    // Client-side download; DPI/compression applied server-side in Phase B5
    void settings;
    const a = document.createElement('a');
    a.href = currentImage.processedUrl ?? currentImage.previewUrl;
    a.download = currentImage.name;
    a.click();
  }, [currentImage]);

  const handleDownloadAll = useCallback((settings: ExportSettings) => {
    // Download each image; ZIP generation deferred to Phase B5
    void settings;
    batchImages.forEach((img) => {
      const a = document.createElement('a');
      a.href = img.processedUrl ?? img.previewUrl;
      a.download = img.name;
      a.click();
    });
  }, [batchImages]);

  // --- Drop handler ---

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (files.length > 0) handleFilesAdded(files);
    },
    [handleFilesAdded],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <EditorRoot onDrop={handleDrop} onDragOver={handleDragOver}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileInputChange}
        aria-label={t('design.editor.browseFiles')}
      />

      {/* Job polling manager (renders nothing visible) */}
      <JobPollerManager jobs={jobs} onUpdate={onJobUpdate} />

      {/* Pipeline Bar (top, collapsible) */}
      <PipelineBarWrapper $expanded={pipelineExpanded}>
        <PipelineBar
          expanded={pipelineExpanded}
          onToggleExpand={() => setPipelineExpanded((p) => !p)}
          activePipeline={activePipeline}
          onAddTool={handleAddTool}
          onRemoveTool={handleRemoveTool}
          onReorder={handleReorderPipeline}
        />
      </PipelineBarWrapper>

      {/* Main content row: left panel + canvas */}
      <ContentRow>
        {/* Left Tool Panel (280px) */}
        <ToolPanelWrapper>
          <ToolPanel
            activePipeline={activePipeline}
            onRemoveTool={handleRemoveTool}
            onToggleTool={handleToggleTool}
            onReorder={handleReorderPipeline}
          />
        </ToolPanelWrapper>

        {/* Canvas area */}
        <CanvasArea>
          <CanvasMain>
            {hasImages && currentImage ? (
              <EditorCanvas
                image={currentImage}
                activeTool={activeCanvasTool}
                onToolChange={setActiveCanvasTool}
                batchIndex={currentImageIndex}
                batchTotal={batchImages.length}
                onNavigate={setCurrentImageIndex}
                onRemoveImage={() => handleRemoveImage(currentImageIndex)}
                onRemoveAll={handleRemoveAll}
              />
            ) : (
              <DropZone
                onBrowse={handleBrowseClick}
                preloadIds={preloadIds}
                onFilesAdded={handleFilesAdded}
              />
            )}
          </CanvasMain>

          {/* Bottom thumbnail strip + export controls */}
          {hasImages && (
            <StripWrapper>
              <BatchThumbnailStrip
                images={batchImages}
                currentIndex={currentImageIndex}
                onSelect={setCurrentImageIndex}
                onToggleExport={() => setShowExport((p) => !p)}
                showExportToggle
              />
              {showExport && (
                <ExportControls
                  currentImage={currentImage}
                  totalImages={batchImages.length}
                  onClose={() => setShowExport(false)}
                  onDownloadCurrent={handleDownloadCurrent}
                  onDownloadAll={handleDownloadAll}
                />
              )}
            </StripWrapper>
          )}
        </CanvasArea>
      </ContentRow>
    </EditorRoot>
  );
};

export default DesignEditorView;
