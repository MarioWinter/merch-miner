import { useState, useCallback, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';

import type { BatchImage, PipelineTool } from '../types';
import {
  processResize,
  DEFAULT_RESIZE_PARAMS,
  processRotateFlip,
  DEFAULT_ROTATE_FLIP_PARAMS,
  processTrim,
  DEFAULT_TRIM_PARAMS,
  processColorAdjustment,
  DEFAULT_COLOR_ADJUSTMENT_PARAMS,
  processColorRemoval,
  DEFAULT_COLOR_REMOVAL_PARAMS,
  processSpeckleRemover,
  DEFAULT_SPECKLE_REMOVER_PARAMS,
  processTransparencyCleaner,
  DEFAULT_TRANSPARENCY_CLEANER_PARAMS,
  processWatermark,
  DEFAULT_WATERMARK_PARAMS,
  processDistress,
  DEFAULT_DISTRESS_PARAMS,
  processShrink,
  DEFAULT_SHRINK_PARAMS,
  processDefringe,
  DEFAULT_DEFRINGE_PARAMS,
  processEdgeCleaner,
  DEFAULT_EDGE_CLEANER_PARAMS,
  processColorDefringe,
  DEFAULT_COLOR_DEFRINGE_PARAMS,
  processCompressor,
  DEFAULT_COMPRESSOR_PARAMS,
  processPicaUpscale,
  DEFAULT_PICA_UPSCALE_PARAMS,
} from '../utils/imageProcessing';
import type {
  ResizeParams,
  RotateFlipParams,
  TrimParams,
  ColorAdjustmentParams,
  ColorRemovalParams,
  ColorTarget,
  SpeckleRemoverParams,
  TransparencyCleanerParams,
  WatermarkParams,
  DistressParams,
  ShrinkParams,
  DefringeParams,
  EdgeCleanerParams,
  ColorDefringeParams,
  CompressorParams,
  TransparencyCleanerHighlightColor,
  PicaUpscaleParams,
} from '../utils/imageProcessing';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface ClientProgress {
  current: number;
  total: number;
  currentImageName: string;
}

export interface UseClientProcessingReturn {
  processImage: (image: BatchImage, tools: PipelineTool[]) => Promise<BatchImage>;
  processBatch: (images: BatchImage[], tools: PipelineTool[]) => Promise<BatchImage[]>;
  isProcessing: boolean;
  progress: ClientProgress;
  cancel: () => void;
}

// -----------------------------------------------------------------
// Tool param resolution
// -----------------------------------------------------------------

/**
 * Convert a PipelineTool's generic params into typed ResizeParams,
 * falling back to defaults for any missing fields.
 */
const resolveResizeParams = (params: Record<string, unknown>): ResizeParams => ({
  targetWidth: (params.targetWidth as number) ?? DEFAULT_RESIZE_PARAMS.targetWidth,
  targetHeight: (params.targetHeight as number) ?? DEFAULT_RESIZE_PARAMS.targetHeight,
  alignY: (params.alignY as ResizeParams['alignY']) ?? DEFAULT_RESIZE_PARAMS.alignY,
  alignX: (params.alignX as ResizeParams['alignX']) ?? DEFAULT_RESIZE_PARAMS.alignX,
  paddingPx: (params.paddingPx as number) ?? DEFAULT_RESIZE_PARAMS.paddingPx,
  bgColor: (params.bgColor as string) ?? DEFAULT_RESIZE_PARAMS.bgColor,
  maintainAspectRatio:
    (params.maintainAspectRatio as boolean) ?? DEFAULT_RESIZE_PARAMS.maintainAspectRatio,
});

/**
 * Convert a PipelineTool's generic params into typed RotateFlipParams,
 * falling back to defaults for any missing fields.
 */
const resolveRotateFlipParams = (params: Record<string, unknown>): RotateFlipParams => ({
  rotation:
    (params.rotation as RotateFlipParams['rotation']) ?? DEFAULT_ROTATE_FLIP_PARAMS.rotation,
  flipH: (params.flipH as boolean) ?? DEFAULT_ROTATE_FLIP_PARAMS.flipH,
  flipV: (params.flipV as boolean) ?? DEFAULT_ROTATE_FLIP_PARAMS.flipV,
});

/**
 * Convert a PipelineTool's generic params into typed TrimParams,
 * falling back to defaults for any missing fields.
 */
const resolveTrimParams = (params: Record<string, unknown>): TrimParams => ({
  threshold: (params.threshold as number) ?? DEFAULT_TRIM_PARAMS.threshold,
  padding: (params.padding as number) ?? DEFAULT_TRIM_PARAMS.padding,
  trimColor: (params.trimColor as TrimParams['trimColor']) ?? DEFAULT_TRIM_PARAMS.trimColor,
});

/**
 * Convert a PipelineTool's generic params into typed ColorAdjustmentParams,
 * falling back to defaults for any missing fields.
 */
const resolveColorAdjustmentParams = (params: Record<string, unknown>): ColorAdjustmentParams => ({
  brightness: (params.brightness as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.brightness,
  contrast: (params.contrast as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.contrast,
  saturation: (params.saturation as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.saturation,
  hueShift: (params.hueShift as number) ?? DEFAULT_COLOR_ADJUSTMENT_PARAMS.hueShift,
});

/**
 * Convert a PipelineTool's generic params into typed ColorRemovalParams,
 * falling back to defaults for any missing fields.
 */
const resolveColorRemovalParams = (params: Record<string, unknown>): ColorRemovalParams => ({
  mode: (params.mode as ColorRemovalParams['mode']) ?? DEFAULT_COLOR_REMOVAL_PARAMS.mode,
  targetColor: (params.targetColor as string) ?? DEFAULT_COLOR_REMOVAL_PARAMS.targetColor,
  tolerance: (params.tolerance as number) ?? DEFAULT_COLOR_REMOVAL_PARAMS.tolerance,
  softEdge: (params.softEdge as boolean) ?? DEFAULT_COLOR_REMOVAL_PARAMS.softEdge,
  contiguous: (params.contiguous as boolean) ?? DEFAULT_COLOR_REMOVAL_PARAMS.contiguous,
  fillHoles: (params.fillHoles as boolean) ?? DEFAULT_COLOR_REMOVAL_PARAMS.fillHoles,
  edgeTrim: (params.edgeTrim as number) ?? DEFAULT_COLOR_REMOVAL_PARAMS.edgeTrim,
  edgeFeather: (params.edgeFeather as number) ?? DEFAULT_COLOR_REMOVAL_PARAMS.edgeFeather,
  colors: (params.colors as ColorTarget[]) ?? DEFAULT_COLOR_REMOVAL_PARAMS.colors,
  hdMode: (params.hdMode as ColorRemovalParams['hdMode']) ?? DEFAULT_COLOR_REMOVAL_PARAMS.hdMode,
});

/**
 * Convert a PipelineTool's generic params into typed SpeckleRemoverParams,
 * falling back to defaults for any missing fields.
 */
const resolveSpeckleRemoverParams = (params: Record<string, unknown>): SpeckleRemoverParams => ({
  minSize: (params.minSize as number) ?? DEFAULT_SPECKLE_REMOVER_PARAMS.minSize,
  connectivity:
    (params.connectivity as SpeckleRemoverParams['connectivity']) ??
    DEFAULT_SPECKLE_REMOVER_PARAMS.connectivity,
  alphaThreshold:
    (params.alphaThreshold as number) ?? DEFAULT_SPECKLE_REMOVER_PARAMS.alphaThreshold,
});

/**
 * Convert a PipelineTool's generic params into typed TransparencyCleanerParams,
 * falling back to defaults for any missing fields.
 */
const resolveTransparencyCleanerParams = (
  params: Record<string, unknown>,
): TransparencyCleanerParams => ({
  threshold:
    (params.threshold as number) ?? DEFAULT_TRANSPARENCY_CLEANER_PARAMS.threshold,
  mode:
    (params.mode as TransparencyCleanerParams['mode']) ??
    DEFAULT_TRANSPARENCY_CLEANER_PARAMS.mode,
  highlightColor:
    (params.highlightColor as TransparencyCleanerHighlightColor) ??
    DEFAULT_TRANSPARENCY_CLEANER_PARAMS.highlightColor,
  visibility:
    (params.visibility as number) ?? DEFAULT_TRANSPARENCY_CLEANER_PARAMS.visibility,
});

/**
 * Convert a PipelineTool's generic params into typed WatermarkParams,
 * falling back to defaults for any missing fields.
 */
const resolveWatermarkParams = (params: Record<string, unknown>): WatermarkParams => ({
  text: (params.text as string) ?? DEFAULT_WATERMARK_PARAMS.text,
  fontSize: (params.fontSize as number) ?? DEFAULT_WATERMARK_PARAMS.fontSize,
  fontFamily: (params.fontFamily as string) ?? DEFAULT_WATERMARK_PARAMS.fontFamily,
  color: (params.color as string) ?? DEFAULT_WATERMARK_PARAMS.color,
  opacity: (params.opacity as number) ?? DEFAULT_WATERMARK_PARAMS.opacity,
  position:
    (params.position as WatermarkParams['position']) ?? DEFAULT_WATERMARK_PARAMS.position,
  rotation: (params.rotation as number) ?? DEFAULT_WATERMARK_PARAMS.rotation,
  tileSpacing: (params.tileSpacing as number) ?? DEFAULT_WATERMARK_PARAMS.tileSpacing,
});

/**
 * Convert a PipelineTool's generic params into typed DistressParams,
 * falling back to defaults for any missing fields.
 */
const resolveDistressParams = (params: Record<string, unknown>): DistressParams => ({
  intensity: (params.intensity as number) ?? DEFAULT_DISTRESS_PARAMS.intensity,
  grainAmount: (params.grainAmount as number) ?? DEFAULT_DISTRESS_PARAMS.grainAmount,
  scratches: (params.scratches as boolean) ?? DEFAULT_DISTRESS_PARAMS.scratches,
  edgeWear: (params.edgeWear as boolean) ?? DEFAULT_DISTRESS_PARAMS.edgeWear,
  seed: (params.seed as number) ?? DEFAULT_DISTRESS_PARAMS.seed,
});

/**
 * Convert a PipelineTool's generic params into typed ShrinkParams,
 * falling back to defaults for any missing fields.
 */
const resolveShrinkParams = (params: Record<string, unknown>): ShrinkParams => ({
  amount: (params.amount as number) ?? DEFAULT_SHRINK_PARAMS.amount,
  alphaThreshold: (params.alphaThreshold as number) ?? DEFAULT_SHRINK_PARAMS.alphaThreshold,
});

/**
 * Convert a PipelineTool's generic params into typed DefringeParams,
 * falling back to defaults for any missing fields.
 */
const resolveDefringeParams = (params: Record<string, unknown>): DefringeParams => ({
  shrinkPx: (params.shrinkPx as number) ?? DEFAULT_DEFRINGE_PARAMS.shrinkPx,
  detectThreshold:
    (params.detectThreshold as number) ?? DEFAULT_DEFRINGE_PARAMS.detectThreshold,
  autoDetect: (params.autoDetect as boolean) ?? DEFAULT_DEFRINGE_PARAMS.autoDetect,
});

/**
 * Convert a PipelineTool's generic params into typed EdgeCleanerParams,
 * falling back to defaults for any missing fields.
 */
const resolveEdgeCleanerParams = (params: Record<string, unknown>): EdgeCleanerParams => ({
  passes: (params.passes as number) ?? DEFAULT_EDGE_CLEANER_PARAMS.passes,
  alphaThreshold:
    (params.alphaThreshold as number) ?? DEFAULT_EDGE_CLEANER_PARAMS.alphaThreshold,
  strength: (params.strength as number) ?? DEFAULT_EDGE_CLEANER_PARAMS.strength,
});

/**
 * Convert a PipelineTool's generic params into typed ColorDefringeParams,
 * falling back to defaults for any missing fields.
 */
const resolveColorDefringeParams = (params: Record<string, unknown>): ColorDefringeParams => ({
  edgeWidth: (params.edgeWidth as number) ?? DEFAULT_COLOR_DEFRINGE_PARAMS.edgeWidth,
  alphaThreshold:
    (params.alphaThreshold as number) ?? DEFAULT_COLOR_DEFRINGE_PARAMS.alphaThreshold,
  colorTolerance:
    (params.colorTolerance as number) ?? DEFAULT_COLOR_DEFRINGE_PARAMS.colorTolerance,
});

/**
 * Convert a PipelineTool's generic params into typed CompressorParams,
 * falling back to defaults for any missing fields.
 */
const resolveCompressorParams = (params: Record<string, unknown>): CompressorParams => ({
  maxSizeKb: (params.maxSizeKb as number) ?? DEFAULT_COMPRESSOR_PARAMS.maxSizeKb,
  quality: (params.quality as number) ?? DEFAULT_COMPRESSOR_PARAMS.quality,
  format:
    (params.format as CompressorParams['format']) ?? DEFAULT_COMPRESSOR_PARAMS.format,
});

/**
 * Convert a PipelineTool's generic params into typed PicaUpscaleParams,
 * falling back to defaults for any missing fields.
 */
const resolvePicaUpscaleParams = (params: Record<string, unknown>): PicaUpscaleParams => ({
  targetWidth: (params.targetWidth as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.targetWidth,
  targetHeight: (params.targetHeight as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.targetHeight,
  filter:
    (params.filter as PicaUpscaleParams['filter']) ?? DEFAULT_PICA_UPSCALE_PARAMS.filter,
  unsharpAmount:
    (params.unsharpAmount as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.unsharpAmount,
  unsharpRadius:
    (params.unsharpRadius as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.unsharpRadius,
  unsharpThreshold:
    (params.unsharpThreshold as number) ?? DEFAULT_PICA_UPSCALE_PARAMS.unsharpThreshold,
});

// -----------------------------------------------------------------
// Client-side tool dispatcher
// -----------------------------------------------------------------

/**
 * Execute a single client-side tool on an image source.
 * Returns a new Blob with the result (or throws on error).
 * Only 'resize' is supported now; more tools will be added later.
 */
const executeClientTool = async (
  source: string | Blob,
  tool: PipelineTool,
): Promise<Blob> => {
  switch (tool.name) {
    case 'resize':
      return processResize(source, resolveResizeParams(tool.params));
    case 'rotate':
      return processRotateFlip(source, resolveRotateFlipParams(tool.params));
    case 'trim':
      return processTrim(source, resolveTrimParams(tool.params));
    case 'filters':
      return processColorAdjustment(source, resolveColorAdjustmentParams(tool.params));
    case 'color_removal':
      return processColorRemoval(source, resolveColorRemovalParams(tool.params));
    case 'speckle_remover':
      return processSpeckleRemover(source, resolveSpeckleRemoverParams(tool.params));
    case 'distress':
      return processDistress(source, resolveDistressParams(tool.params));
    case 'transparency_cleaner':
      return processTransparencyCleaner(source, resolveTransparencyCleanerParams(tool.params));
    case 'watermark':
      return processWatermark(source, resolveWatermarkParams(tool.params));
    case 'shrink':
      return processShrink(source, resolveShrinkParams(tool.params));
    case 'defringe':
      return processDefringe(source, resolveDefringeParams(tool.params));
    case 'edge_cleaner':
      return processEdgeCleaner(source, resolveEdgeCleanerParams(tool.params));
    case 'color_defringe':
      return processColorDefringe(source, resolveColorDefringeParams(tool.params));
    case 'compressor':
      return processCompressor(source, resolveCompressorParams(tool.params));
    case 'ai_upscale':
      return processPicaUpscale(source, resolvePicaUpscaleParams(tool.params));
    default:
      throw new Error(`Client tool "${tool.name}" is not implemented`);
  }
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const INITIAL_PROGRESS: ClientProgress = { current: 0, total: 0, currentImageName: '' };

/**
 * Hook that runs client-side pipeline tools on batch images.
 * Tools are executed sequentially: tool1(image) -> tool2(result) -> ...
 * Each image gets an updated processedUrl + status.
 */
export const useClientProcessing = (): UseClientProcessingReturn => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ClientProgress>(INITIAL_PROGRESS);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  /**
   * Process a single image through an ordered list of client tools.
   */
  const processImage = useCallback(
    async (image: BatchImage, tools: PipelineTool[]): Promise<BatchImage> => {
      const enabledTools = tools.filter((tool) => tool.enabled);
      if (enabledTools.length === 0) return image;

      // Determine initial source: processedUrl > previewUrl > file
      let currentSource: string | Blob =
        image.processedUrl ?? image.previewUrl;
      if (image.file && !image.processedUrl) {
        currentSource = image.file;
      }

      try {
        for (const tool of enabledTools) {
          if (cancelledRef.current) {
            return { ...image, status: 'idle' };
          }
          const resultBlob = await executeClientTool(currentSource, tool);
          // Chain: next tool receives previous result
          currentSource = resultBlob;
        }

        // Final result — create an object URL for preview
        const processedUrl =
          currentSource instanceof Blob
            ? URL.createObjectURL(currentSource)
            : currentSource;

        return {
          ...image,
          processedUrl,
          status: 'completed',
          errorMessage: undefined,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ...image,
          status: 'error',
          errorMessage: message,
        };
      }
    },
    [],
  );

  /**
   * Process a batch of images through the same ordered tool list.
   * Updates progress state for UI feedback.
   */
  const processBatch = useCallback(
    async (images: BatchImage[], tools: PipelineTool[]): Promise<BatchImage[]> => {
      const enabledTools = tools.filter((tool) => tool.enabled);
      if (images.length === 0 || enabledTools.length === 0) return images;

      setIsProcessing(true);
      cancelledRef.current = false;
      setProgress({ current: 0, total: images.length, currentImageName: '' });

      const results: BatchImage[] = [];

      for (let i = 0; i < images.length; i++) {
        if (cancelledRef.current) {
          // Push remaining images unchanged
          results.push(...images.slice(i));
          break;
        }

        setProgress({
          current: i + 1,
          total: images.length,
          currentImageName: images[i].name,
        });

        const processed = await processImage(
          { ...images[i], status: 'processing' },
          enabledTools,
        );
        results.push(processed);
      }

      setIsProcessing(false);
      setProgress(INITIAL_PROGRESS);

      const failedCount = results.filter((r) => r.status === 'error').length;
      if (failedCount > 0) {
        enqueueSnackbar(
          t('design.editor.processingPartialFail', { count: failedCount }),
          { variant: 'warning' },
        );
      } else if (!cancelledRef.current) {
        enqueueSnackbar(t('design.editor.processingComplete'), { variant: 'success' });
      }

      return results;
    },
    [processImage, enqueueSnackbar, t],
  );

  return { processImage, processBatch, isProcessing, progress, cancel };
};
