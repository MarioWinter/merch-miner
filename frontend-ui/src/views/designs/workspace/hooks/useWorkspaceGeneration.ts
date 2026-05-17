import { useCallback, useEffect, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import type { ArtboardData, BackgroundColor, DesignModel } from '../../board/types';
import type { GenerationMode, AspectRatio } from '../../board/partials/GenerationZone';
import { useGeneration } from '../../board/hooks/useGeneration';
import { usePromptBuilder } from '../../board/hooks/usePromptBuilder';
import { useImageAnalysis } from '../../board/hooks/useImageAnalysis';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseWorkspaceGenerationParams {
  projectId: string;
  nicheId: string | null;
  /** Full board designs (with generation_run.id for skeleton matching) */
  boardDesigns?: Array<{
    id: string;
    image_file: string | null;
    status: string;
    generation_run?: { id?: string; status?: string } | null;
  }>;
  /** Active runs (pending/running/failed) — drives error UX on skeletons */
  activeRuns?: Array<{ id: string; status: string; error_message: string }>;
  /** Current artboards (read-only access for reconciliation) */
  artboards?: ArtboardData[];
  /** Selected artboard from panel state */
  selectedArtboard: ArtboardData | null;
  /** Artboard mutations */
  addArtboard: (partial?: Partial<ArtboardData>) => ArtboardData;
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  pushHistory: () => void;
  /** Whether the selected artboard has an image */
  hasSelectedImage: boolean;
}

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useWorkspaceGeneration = ({
  projectId,
  nicheId,
  boardDesigns,
  activeRuns,
  artboards,
  selectedArtboard,
  addArtboard,
  updateArtboard,
  pushHistory,
  hasSelectedImage,
}: UseWorkspaceGenerationParams) => {
  // -- Prompt state --
  const [prompt, setPrompt] = useState('');
  const [aiModel, setAiModel] = useState<DesignModel>('google/gemini-3.1-flash-preview-image-generation');
  const [bgColor, setBgColor] = useState<BackgroundColor>('light_gray');
  const [imageCount, setImageCount] = useState(1);
  const [isParallel, setIsParallel] = useState(false);
  const [generationMode, setGenerationMode] = useState<GenerationMode>('text_to_image');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImageUrl2, setSourceImageUrl2] = useState<string | null>(null);

  // -- AI generation --
  const generation = useGeneration(projectId);
  const { enqueueSnackbar } = useSnackbar();
  const failedRunHandledRef = useRef<Set<string>>(new Set());

  // -- Prompt Builder --
  const promptBuilder = usePromptBuilder(projectId, nicheId);
  const [promptBuilderOpen, setPromptBuilderOpen] = useState(false);

  // -- Image analysis (G13) --
  const imageAnalysis = useImageAnalysis(projectId);

  // Fill prompt when analysis completes
  useEffect(() => {
    if (!imageAnalysis.lastPrompt) return;
    // Async to avoid cascading render within effect
    queueMicrotask(() => setPrompt(imageAnalysis.lastPrompt!));
  }, [imageAnalysis.lastPrompt]);

  // -- Sync prompt when selecting an AI artboard --
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const id = selectedArtboard?.id ?? null;
    if (id === prevSelectedIdRef.current) return;
    prevSelectedIdRef.current = id;
    if (selectedArtboard?.kind === 'ai' && selectedArtboard.promptUsed) {
      queueMicrotask(() => {
        setPrompt(selectedArtboard.promptUsed!);
        if (selectedArtboard.modelUsed) setAiModel(selectedArtboard.modelUsed);
        if (selectedArtboard.bgColorUsed) setBgColor(selectedArtboard.bgColorUsed);
      });
    }
  }, [selectedArtboard]);

  // -- Reconcile skeleton artboards with completed runs --
  // Matches designs to skeletons via generation_run.id <-> pendingRunId.
  // Survives page reload: skeletons are restored from board_layout JSON,
  // so even after F5 the design lands in the right slot.
  useEffect(() => {
    if (!boardDesigns || !artboards) return;
    const skeletons = artboards.filter((ab) => ab.isGenerating && ab.pendingRunId);
    if (skeletons.length === 0) return;
    for (const ab of skeletons) {
      const match = boardDesigns.find(
        (d) => d.generation_run?.id === ab.pendingRunId && d.image_file,
      );
      if (match) {
        updateArtboard(ab.id, {
          imageUrl: match.image_file,
          designId: match.id,
          isGenerating: false,
          pendingRunId: null,
          hasError: false,
        });
      }
    }
  }, [boardDesigns, artboards, updateArtboard]);

  // -- Reconcile skeletons with FAILED runs --
  // When the worker marks a run failed, no design is created. We surface the
  // error on the matching skeleton and notify the user once per run.
  useEffect(() => {
    if (!activeRuns || !artboards) return;
    const failedById = new Map(
      activeRuns.filter((r) => r.status === 'failed').map((r) => [r.id, r]),
    );
    if (failedById.size === 0) return;
    for (const ab of artboards) {
      if (!ab.pendingRunId || !ab.isGenerating) continue;
      const failed = failedById.get(ab.pendingRunId);
      if (!failed) continue;
      updateArtboard(ab.id, {
        isGenerating: false,
        hasError: true,
        pendingRunId: null,
      });
      if (!failedRunHandledRef.current.has(failed.id)) {
        failedRunHandledRef.current.add(failed.id);
        enqueueSnackbar(
          failed.error_message
            ? `Generation failed: ${failed.error_message.slice(0, 120)}`
            : 'Generation failed',
          { variant: 'error' },
        );
      }
    }
  }, [activeRuns, artboards, updateArtboard, enqueueSnackbar]);

  // -- Handlers --

  const handleOpenPromptBuilder = useCallback(() => {
    promptBuilder.reset();
    setPromptBuilderOpen(true);
  }, [promptBuilder]);

  const handleClosePromptBuilder = useCallback(() => {
    setPromptBuilderOpen(false);
  }, []);

  const handleInsertSlogan = useCallback((sloganText: string) => {
    setPrompt(sloganText);
  }, []);

  const handleUseAsReference = useCallback((imageUrl: string) => {
    if (generationMode === 'remix') {
      if (!sourceImageUrl) {
        setSourceImageUrl(imageUrl);
      } else if (!sourceImageUrl2) {
        setSourceImageUrl2(imageUrl);
      } else {
        setSourceImageUrl(imageUrl);
      }
      return;
    }
    setSourceImageUrl(imageUrl);
    if (generationMode === 'text_to_image') {
      setGenerationMode('image_to_image_edit');
    }
  }, [generationMode, sourceImageUrl, sourceImageUrl2]);

  const handleClearSourceImage = useCallback(() => {
    setSourceImageUrl(null);
  }, []);

  const handleClearSourceImage2 = useCallback(() => {
    setSourceImageUrl2(null);
  }, []);

  const handleUseAsPrompt = useCallback((analysisText: string) => {
    setPrompt(analysisText);
  }, []);

  const handleCreateSkeletonArtboards = useCallback(
    (items: Array<{ runId: string; label: string }>) => {
      pushHistory();
      for (const item of items) {
        addArtboard({ label: item.label, kind: 'ai', width: 280, height: 280, isGenerating: true });
      }
    },
    [addArtboard, pushHistory],
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generation.isGenerating) return;
    pushHistory();
    const skeletonAb = addArtboard({
      label: `AI: ${prompt.slice(0, 30)}${prompt.length > 30 ? '\u2026' : ''}`,
      kind: 'ai', width: 280, height: 280, isGenerating: true,
      promptUsed: prompt, modelUsed: aiModel, bgColorUsed: bgColor,
    });
    // Source URLs may be relative (/media/...) for local references; the
    // backend serializer requires absolute URLs.
    const toAbsolute = (u: string | null) =>
      u && u.startsWith('/') ? `${window.location.origin}${u}` : u;
    try {
      const run = await generation.trigger({
        model: aiModel,
        background_color: bgColor,
        prompt,
        mode: generationMode,
        aspect_ratio: aspectRatio,
        ...(sourceImageUrl ? { source_image_url: toAbsolute(sourceImageUrl) as string } : {}),
        ...(sourceImageUrl2 ? { source_image_url_2: toAbsolute(sourceImageUrl2) as string } : {}),
      });
      // Persist the run id on the skeleton so we can reconnect after F5.
      updateArtboard(skeletonAb.id, { pendingRunId: run.id });
      setSourceImageUrl(null);
      setSourceImageUrl2(null);
    } catch {
      updateArtboard(skeletonAb.id, { isGenerating: false, pendingRunId: null });
    }
  }, [
    prompt, generation, addArtboard, updateArtboard, aiModel, bgColor,
    pushHistory, sourceImageUrl, sourceImageUrl2, generationMode, aspectRatio,
  ]);

  return {
    // Prompt state
    prompt, setPrompt,
    aiModel, setAiModel,
    bgColor, setBgColor,
    imageCount, setImageCount,
    isParallel, setIsParallel,
    generationMode, setGenerationMode,
    aspectRatio, setAspectRatio,
    sourceImageUrl,
    sourceImageUrl2,
    // Generation
    generation,
    handleGenerate,
    // Prompt Builder
    promptBuilder,
    promptBuilderOpen,
    handleOpenPromptBuilder,
    handleClosePromptBuilder,
    // Image analysis
    imageAnalysis,
    hasSelectedImage,
    // Slogan/reference handlers
    handleInsertSlogan,
    handleUseAsReference,
    handleClearSourceImage,
    handleClearSourceImage2,
    handleUseAsPrompt,
    handleCreateSkeletonArtboards,
  };
};

export default useWorkspaceGeneration;
