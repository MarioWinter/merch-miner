import { useCallback, useState } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { COLORS } from '@/style/constants';
import { PipelineBar } from './partials/PipelineBar';
import { ToolPanel } from './partials/ToolPanel';
import { EditorCanvas } from './partials/EditorCanvas';
import { BatchThumbnailStrip } from './partials/BatchThumbnailStrip';
import { UnifiedBottomBar } from './partials/UnifiedBottomBar';
import { PreparingDownloadModal } from './partials/PreparingDownloadModal';
import { DropZone } from './partials/DropZone';
import { CloudManagerDialog } from './partials/CloudManagerDialog';
import { useProcessing } from './hooks/useProcessing';
import { useClientProcessing } from './hooks/useClientProcessing';
import { useLivePreview } from './hooks/useLivePreview';
import { useExportCompression } from './hooks/useExportCompression';
import { JobPollerManager } from './partials/JobPollerManager';
import ConfirmDialog from '@/components/ConfirmDialog';
import useEditorBatchState from './hooks/useEditorBatchState';
import type { PipelineTool, CanvasToolType, CompressionLevel, ExportSettings } from './types';

// -----------------------------------------------------------------
// Props
// -----------------------------------------------------------------

interface DesignEditorViewProps {
  projectId: string;
  editorBatch?: Array<{ id: string; url: string; name: string; width?: number; height?: number }>;
  onAddToCanvas?: (data: { url: string; name: string; width?: number; height?: number }) => void;
}

// -----------------------------------------------------------------
// Constants
// -----------------------------------------------------------------

const TOOL_PANEL_WIDTH = 280;
const THUMBNAIL_STRIP_HEIGHT = 80;

// -----------------------------------------------------------------
// Styled
// -----------------------------------------------------------------

const EditorRoot = styled(Box)({
  display: 'flex', flexDirection: 'column', height: '100%', width: '100%',
  flex: 1, minWidth: 0, overflow: 'hidden', position: 'relative',
});

const PipelineBarWrapper = styled(Box)(({ theme }) => ({
  flexShrink: 0, backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', { backgroundColor: COLORS.white }),
}));

const ContentRow = styled(Box)({ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' });

const ToolPanelWrapper = styled(Box)(({ theme }) => ({
  width: TOOL_PANEL_WIDTH, flexShrink: 0, backgroundColor: COLORS.ink,
  overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin',
  ...theme.applyStyles('light', { backgroundColor: COLORS.white }),
}));

const CanvasArea = styled(Box)({ flex: 1, minWidth: 0, position: 'relative', display: 'flex', flexDirection: 'column' });

const CanvasMain = styled(Box)(({ theme }) => ({
  flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', { backgroundColor: COLORS.ash }),
}));

const StripWrapper = styled(Box)(({ theme }) => ({
  flexShrink: 0, display: 'flex', flexDirection: 'column',
  borderTop: '1px solid', borderColor: theme.vars.palette.divider,
  backgroundColor: COLORS.ink,
  ...theme.applyStyles('light', { backgroundColor: COLORS.white }),
}));

const ThumbnailRow = styled(Box)({ height: THUMBNAIL_STRIP_HEIGHT, display: 'flex' });

// -----------------------------------------------------------------
// Component
// -----------------------------------------------------------------

const DesignEditorView = ({ projectId, editorBatch, onAddToCanvas }: DesignEditorViewProps) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Pipeline state
  const [activePipeline, setActivePipeline] = useState<PipelineTool[]>([]);
  const [activeCanvasTool, setActiveCanvasTool] = useState<CanvasToolType>('move');
  const [exportCompressionLevel, setExportCompressionLevel] = useState<CompressionLevel>('medium');
  const [cloudManagerOpen, setCloudManagerOpen] = useState(false);

  // Batch state (destructured to satisfy react-hooks/refs lint rule)
  const {
    batchImages, setBatchImages, currentImageIndex, setCurrentImageIndex,
    currentImage, hasImages, fileInputRef, preloadIds, undoRedo, selection,
    isDeletingDesign, deleteConfirmIndex, loadImageMeta, saveProcessedImage,
    handleFilesAdded, handleBrowseClick, handleFileInputChange,
    handleRemoveImage, handleRemoveAll, handleDeleteFromServer,
    handleDeleteConfirm, handleDeleteCancel, handleDeleteVersion,
    handleUndo, handleRedo, handleDrop, handleDragOver, getBatchFile,
    isUpscaleClientSide, ALWAYS_SERVER_TOOLS,
  } = useEditorBatchState({ projectId, editorBatch });

  // Processing hooks
  const { startProcessing, jobs, onJobUpdate } = useProcessing();
  const { processBatch, isProcessing, progress, cancel: cancelProcessing } = useClientProcessing();

  // Live preview
  const { previewUrl: livePreviewUrl, isProcessing: isPreviewProcessing } = useLivePreview(currentImage, activePipeline);

  // Export compression
  const exportState = useExportCompression();

  // -- Pipeline handlers --
  const handleAddTool = useCallback((tool: PipelineTool) => { setActivePipeline((prev) => [...prev, tool]); }, []);
  const handleRemoveTool = useCallback((toolId: string) => { setActivePipeline((prev) => prev.filter((t) => t.id !== toolId)); }, []);
  const handleReorderPipeline = useCallback((tools: PipelineTool[]) => { setActivePipeline(tools); }, []);
  const handleToggleTool = useCallback((toolId: string) => { setActivePipeline((prev) => prev.map((t) => (t.id === toolId ? { ...t, enabled: !t.enabled } : t))); }, []);
  const handleUpdateParams = useCallback((toolId: string, params: Record<string, unknown>) => { setActivePipeline((prev) => prev.map((t) => (t.id === toolId ? { ...t, params } : t))); }, []);

  // -- Apply pipeline --
  const handleApplyPipeline = useCallback(async () => {
    if (batchImages.length === 0) return;
    undoRedo.pushSnapshot(batchImages);

    const refW = currentImage?.width;
    const refH = currentImage?.height;

    const clientTools = activePipeline.filter((tool) => {
      if (!tool.enabled) return false;
      if (ALWAYS_SERVER_TOOLS.includes(tool.name)) return false;
      if (tool.name === 'ai_upscale') return isUpscaleClientSide(tool, refW, refH);
      return true;
    });

    const serverTools = activePipeline.filter((tool) => {
      if (!tool.enabled) return false;
      if (ALWAYS_SERVER_TOOLS.includes(tool.name)) return true;
      if (tool.name === 'ai_upscale') return !isUpscaleClientSide(tool, refW, refH);
      return false;
    });

    if (clientTools.length > 0) {
      const results = await processBatch(batchImages, clientTools);
      setBatchImages(results);
      results.forEach((img) => {
        const url = img.processedUrl ?? img.previewUrl;
        if (url) loadImageMeta(img.id, url);
      });
      for (const img of results) {
        if (img.processedUrl && img.designId && img.processedUrl.startsWith('blob:')) {
          try {
            const resp = await fetch(img.processedUrl);
            const blob = await resp.blob();
            const file = new File([blob], img.name, { type: blob.type || 'image/png' });
            const design = await saveProcessedImage({ designId: img.designId, file, projectId }).unwrap();
            setBatchImages((prev) =>
              prev.map((bi) =>
                bi.designId === img.designId
                  ? { ...bi, previewUrl: design.processed_file || design.image_file, processedUrl: design.processed_file || undefined, originalUrl: design.image_file }
                  : bi,
              ),
            );
          } catch { /* Keep blob URL as fallback */ }
        }
      }
      enqueueSnackbar(t('design.editor.pipelineSaved', 'Pipeline applied & saved'), { variant: 'success' });
    }

    if (serverTools.length > 0) {
      const designIds = batchImages.filter((img) => img.designId).map((img) => img.designId!);
      if (designIds.length > 0) {
        const steps = serverTools.map((t) => t.name) as Array<'bg_remove' | 'upscale'>;
        await startProcessing(designIds, steps);
      }
    }
  }, [activePipeline, batchImages, currentImage, processBatch, startProcessing, undoRedo, saveProcessedImage, projectId, enqueueSnackbar, t, loadImageMeta, setBatchImages, isUpscaleClientSide, ALWAYS_SERVER_TOOLS]);

  // -- Job update handler --
  const handleJobUpdate = useCallback(
    (...args: Parameters<typeof onJobUpdate>) => {
      const [jobId, status, resultFileUrl, errorMessage] = args;
      onJobUpdate(jobId, status, resultFileUrl, errorMessage);
      if (status === 'completed' && resultFileUrl) {
        const job = jobs.find((j) => j.jobId === jobId);
        if (job) {
          setBatchImages((prev) =>
            prev.map((img) => (img.designId === job.designId ? { ...img, processedUrl: resultFileUrl, status: 'completed' } : img)),
          );
          const batchImg = batchImages.find((img) => img.designId === job.designId);
          if (batchImg) loadImageMeta(batchImg.id, resultFileUrl);
        }
      }
    },
    [onJobUpdate, jobs, batchImages, loadImageMeta, setBatchImages],
  );

  // -- Run single server tool --
  const handleRunServerTool = useCallback(
    async (toolName: string) => {
      if (!currentImage?.designId) return;
      const steps = [toolName] as Array<'bg_remove' | 'upscale'>;
      const tool = activePipeline.find((t) => t.name === toolName);
      const model = (tool?.params?.model as string) || undefined;
      await startProcessing([currentImage.designId], steps, model);
    },
    [currentImage, startProcessing, activePipeline],
  );

  const isServerProcessing = jobs.some((j) => j.status === 'pending' || j.status === 'running');

  // -- Add to Canvas --
  const handleAddToCanvas = useCallback(() => {
    if (!currentImage || !onAddToCanvas) return;
    onAddToCanvas({
      url: currentImage.processedUrl ?? currentImage.previewUrl,
      name: currentImage.name, width: currentImage.width, height: currentImage.height,
    });
  }, [currentImage, onAddToCanvas]);

  const handleAddSelectedToCanvas = useCallback(() => {
    if (!onAddToCanvas || selection.selectedCount === 0) return;
    const selected = batchImages.filter((img) => selection.selectedIds.has(img.id));
    for (const img of selected) {
      onAddToCanvas({ url: img.processedUrl ?? img.previewUrl, name: img.name, width: img.width, height: img.height });
    }
    selection.deselectAll();
    enqueueSnackbar(t('design.transfer.addedToCanvas', '{{count}} image(s) added to Canvas', { count: selected.length }), { variant: 'success' });
  }, [onAddToCanvas, selection, batchImages, enqueueSnackbar, t]);

  // -- Export --
  const handleDownloadCurrent = useCallback((settings: ExportSettings) => {
    if (!currentImage) return;
    setExportCompressionLevel(settings.compression);
    void exportState.downloadCurrent(currentImage, settings.compression);
  }, [currentImage, exportState]);

  const handleDownloadAll = useCallback((settings: ExportSettings) => {
    if (batchImages.length === 0) return;
    setExportCompressionLevel(settings.compression);
    void exportState.downloadAll(batchImages, settings.compression);
  }, [batchImages, exportState]);

  return (
    <EditorRoot onDrop={handleDrop} onDragOver={handleDragOver}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple hidden onChange={handleFileInputChange} aria-label={t('design.editor.browseFiles')} />
      <JobPollerManager jobs={jobs} onUpdate={handleJobUpdate} />

      <PipelineBarWrapper>
        <PipelineBar activePipeline={activePipeline} onAddTool={handleAddTool} onToggleTool={handleToggleTool} onRemoveTool={handleRemoveTool} onReorder={handleReorderPipeline} />
      </PipelineBarWrapper>

      <ContentRow>
        <ToolPanelWrapper>
          <ToolPanel
            activePipeline={activePipeline} onRemoveTool={handleRemoveTool} onToggleTool={handleToggleTool}
            onReorder={handleReorderPipeline} onUpdateParams={handleUpdateParams} onApply={handleApplyPipeline}
            isProcessing={isProcessing} progress={progress} onCancelProcessing={cancelProcessing}
            hasImages={hasImages} onRunServerTool={handleRunServerTool} isServerProcessing={isServerProcessing}
          />
        </ToolPanelWrapper>

        <CanvasArea>
          <CanvasMain>
            {hasImages && currentImage ? (
              <EditorCanvas
                image={currentImage} activeTool={activeCanvasTool} onToolChange={setActiveCanvasTool}
                batchIndex={currentImageIndex} batchTotal={batchImages.length}
                onNavigate={setCurrentImageIndex} onRemoveImage={() => handleRemoveImage(currentImageIndex)}
                onRemoveAll={handleRemoveAll}
                onDeleteFromServer={currentImage?.designId ? handleDeleteFromServer : undefined}
                onDeleteVersion={currentImage?.designId ? handleDeleteVersion : undefined}
                livePreviewUrl={livePreviewUrl} isPreviewProcessing={isPreviewProcessing}
                isServerProcessing={isServerProcessing}
                onUndo={handleUndo} onRedo={handleRedo}
                canUndo={undoRedo.canUndo} canRedo={undoRedo.canRedo}
              />
            ) : (
              <DropZone onBrowse={handleBrowseClick} preloadIds={preloadIds} onFilesAdded={handleFilesAdded} onOpenCloudManager={() => setCloudManagerOpen(true)} />
            )}
          </CanvasMain>

          {hasImages && (
            <StripWrapper>
              <ThumbnailRow>
                <BatchThumbnailStrip
                  images={batchImages} currentIndex={currentImageIndex} onSelect={setCurrentImageIndex}
                  onAddMore={handleBrowseClick} onOpenCloudManager={() => setCloudManagerOpen(true)}
                  selectedIds={selection.selectedIds} onToggleSelect={selection.toggleSelect}
                  onShiftSelect={(index) => selection.shiftSelect(index, batchImages)}
                  onSelectAll={() => selection.selectAll(batchImages)} onDeselectAll={selection.deselectAll}
                />
              </ThumbnailRow>
              <UnifiedBottomBar
                currentImage={currentImage} totalImages={batchImages.length}
                onDownloadCurrent={handleDownloadCurrent} onDownloadAll={handleDownloadAll}
                onAddToCanvas={onAddToCanvas ? handleAddToCanvas : undefined}
                selectedCount={selection.selectedCount}
                onAddSelectedToCanvas={onAddToCanvas ? handleAddSelectedToCanvas : undefined}
              />
            </StripWrapper>
          )}
        </CanvasArea>
      </ContentRow>

      <CloudManagerDialog
        open={cloudManagerOpen} onClose={() => setCloudManagerOpen(false)}
        onFilesAdded={handleFilesAdded} batchFileNames={batchImages.map((img) => img.name)} getBatchFile={getBatchFile}
      />
      <PreparingDownloadModal
        open={exportState.isCompressing} onCancel={exportState.cancel} compressionLevel={exportCompressionLevel}
        progress={exportState.progress} currentImage={exportState.currentImageIndex} totalImages={exportState.totalImages}
      />
      <ConfirmDialog
        open={deleteConfirmIndex !== null}
        title={t('design.editor.deleteServerDialogTitle')}
        body={t('design.editor.deleteServerDialogBody', { name: deleteConfirmIndex !== null ? batchImages[deleteConfirmIndex]?.name ?? '' : '' })}
        confirmLabel={t('design.editor.deleteServerConfirm')} cancelLabel={t('design.editor.deleteServerCancel')}
        onConfirm={handleDeleteConfirm} onCancel={handleDeleteCancel} isLoading={isDeletingDesign}
      />
    </EditorRoot>
  );
};

export default DesignEditorView;
