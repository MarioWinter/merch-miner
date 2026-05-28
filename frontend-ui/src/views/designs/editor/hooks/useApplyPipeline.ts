import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSaveProcessedImageMutation } from '@/store/designSlice';
import type { BatchImage, PipelineTool, ToolName } from '../types';
import type { Design } from '../../board/types';

interface UseApplyPipelineArgs {
  activePipeline: PipelineTool[];
  batchImages: BatchImage[];
  setBatchImages: (updater: (prev: BatchImage[]) => BatchImage[]) => void;
  ALWAYS_SERVER_TOOLS: readonly ToolName[];
  projectId: string;
  currentImage: BatchImage | null;
  currentDesign: Design | null;
  processBatch: (images: BatchImage[], tools: PipelineTool[]) => Promise<BatchImage[]>;
  startProcessing: (designIds: string[], steps: Array<'bg_remove' | 'upscale'>) => Promise<unknown>;
  loadImageMeta: (id: string, url: string) => void;
  undoRedo: { pushSnapshot: (snapshot: BatchImage[]) => void };
  pipelineUpscale: { runUpscaleAsync: () => Promise<void> };
  onOptimisticUpdate?: (designId: string, url: string | null) => void;
  /** Open the overwrite-confirm dialog; pass the pending exec callback. */
  setPendingPipelineExec: (fn: (() => void) | null) => void;
}

/**
 * Phase 5 — async Apply Pipeline orchestrator.
 *
 * `ai_upscale` IS supported in the pipeline but uses the Replicate path via
 * `pipelineUpscale.runUpscaleAsync` rather than `startProcessing`. The two
 * `ai_upscale` filter lines below are INTENTIONALLY KEPT: they peel the
 * upscale step out of the client/server buckets so it can be executed last
 * via the dedicated Replicate flow (which polls `upscaled_file` and honors
 * quota / cloud-destination state). See spec AC-4-1.
 *
 * Phase 9 — optimistic Apply Pipeline overlay paints the local blob URL onto
 * canvas artboards immediately so the user sees the transform before the
 * server round-trip. Cleared on `saveProcessedImage` success OR failure.
 */
export const useApplyPipeline = ({
  activePipeline,
  batchImages,
  setBatchImages,
  ALWAYS_SERVER_TOOLS,
  projectId,
  currentImage,
  currentDesign,
  processBatch,
  startProcessing,
  loadImageMeta,
  undoRedo,
  pipelineUpscale,
  onOptimisticUpdate,
  setPendingPipelineExec,
}: UseApplyPipelineArgs) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [saveProcessedImage] = useSaveProcessedImageMutation();

  return useCallback(async () => {
    if (batchImages.length === 0) return;

    const enabledSteps = activePipeline.filter((tool) => tool.enabled);
    const upscaleStep = enabledSteps.find((t) => t.name === 'ai_upscale') ?? null;
    if (upscaleStep && enabledSteps[enabledSteps.length - 1]?.id !== upscaleStep.id) {
      enqueueSnackbar(
        t(
          'design.pipeline.upscaleMustBeLast',
          'AI Upscale must be the last step in the pipeline.',
        ),
        { variant: 'error' },
      );
      return;
    }

    const clientTools = activePipeline.filter((tool) => {
      if (!tool.enabled) return false;
      if (tool.name === 'ai_upscale') return false;
      if (ALWAYS_SERVER_TOOLS.includes(tool.name)) return false;
      return true;
    });

    const serverTools = activePipeline.filter((tool) => {
      if (!tool.enabled) return false;
      if (tool.name === 'ai_upscale') return false;
      return ALWAYS_SERVER_TOOLS.includes(tool.name);
    });

    const executeApplyPipeline = async () => {
      undoRedo.pushSnapshot(batchImages);

      if (clientTools.length > 0) {
        const results = await processBatch(batchImages, clientTools);
        setBatchImages(() => results);
        results.forEach((img) => {
          const url = img.processedUrl ?? img.previewUrl;
          if (url) loadImageMeta(img.id, url);
        });
        for (const img of results) {
          if (img.processedUrl && img.designId) {
            onOptimisticUpdate?.(img.designId, img.processedUrl);
          }
        }
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
                    ? {
                        ...bi,
                        previewUrl: design.processed_file || design.image_file || '',
                        processedUrl: design.processed_file || undefined,
                        originalUrl: design.image_file ?? undefined,
                      }
                    : bi,
                ),
              );
              onOptimisticUpdate?.(img.designId, null);
            } catch {
              onOptimisticUpdate?.(img.designId, null);
            }
          }
        }
        enqueueSnackbar(t('design.editor.pipelineSaved', 'Pipeline applied & saved'), { variant: 'success' });
      }

      if (serverTools.length > 0) {
        const designIds = batchImages.filter((img) => img.designId).map((img) => img.designId!);
        if (designIds.length > 0) {
          const steps = serverTools.map((tt) => tt.name) as Array<'bg_remove' | 'upscale'>;
          await startProcessing(designIds, steps);
        }
      }

      if (upscaleStep && currentImage?.designId) {
        try {
          await pipelineUpscale.runUpscaleAsync();
        } catch {
          // Error snackbar surfaced by `useUpscaleSingle` already; abort silently.
        }
      }
    };

    if (upscaleStep && currentDesign?.upscaled_file) {
      setPendingPipelineExec(() => executeApplyPipeline);
      return;
    }

    await executeApplyPipeline();
  }, [
    activePipeline,
    batchImages,
    processBatch,
    startProcessing,
    undoRedo,
    saveProcessedImage,
    projectId,
    enqueueSnackbar,
    t,
    loadImageMeta,
    setBatchImages,
    ALWAYS_SERVER_TOOLS,
    currentDesign,
    currentImage,
    pipelineUpscale,
    onOptimisticUpdate,
    setPendingPipelineExec,
  ]);
};

export default useApplyPipeline;
