import { useCallback, useEffect, useRef, useState } from 'react';
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
  /** Board designs from API (for detecting new design arrivals) */
  boardDesigns?: Array<{ id: string; image_file: string | null; status: string }>;
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

  // -- AI generation --
  const generation = useGeneration(projectId);
  const generatingArtboardRef = useRef<string | null>(null);

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

  // -- Update skeleton artboard when generation completes --
  const prevDesignCountRef = useRef(boardDesigns?.length ?? 0);
  useEffect(() => {
    if (!boardDesigns || !generatingArtboardRef.current) return;
    const prevCount = prevDesignCountRef.current;
    prevDesignCountRef.current = boardDesigns.length;
    if (boardDesigns.length > prevCount && !generation.isGenerating) {
      const newest = boardDesigns[0];
      if (newest?.image_file) {
        updateArtboard(generatingArtboardRef.current, {
          imageUrl: newest.image_file,
          designId: newest.id,
          isGenerating: false,
        });
        generatingArtboardRef.current = null;
      }
    }
  }, [boardDesigns, generation.isGenerating, updateArtboard]);

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
    setGenerationMode('image_to_image');
    setSourceImageUrl(imageUrl);
  }, []);

  const handleClearSourceImage = useCallback(() => {
    setSourceImageUrl(null);
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
    generatingArtboardRef.current = skeletonAb.id;
    try {
      await generation.trigger({
        model: aiModel, background_color: bgColor, prompt,
        ...(sourceImageUrl ? { source_image_url: sourceImageUrl } : {}),
      });
      setSourceImageUrl(null);
    } catch {
      updateArtboard(skeletonAb.id, { isGenerating: false });
    }
  }, [prompt, generation, addArtboard, updateArtboard, aiModel, bgColor, pushHistory, sourceImageUrl]);

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
    handleUseAsPrompt,
    handleCreateSkeletonArtboards,
  };
};

export default useWorkspaceGeneration;
