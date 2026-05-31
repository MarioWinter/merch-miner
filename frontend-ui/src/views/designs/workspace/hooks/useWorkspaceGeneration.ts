import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import type { ArtboardData, BackgroundColor, DesignModel } from '../../board/types';
import type { GenerationMode, AspectRatio } from '../../board/partials/GenerationZone';
import { useGeneration } from '../../board/hooks/useGeneration';
import { useBuilder } from '../../board/hooks/useBuilder';
import { useImageAnalysis } from '../../board/hooks/useImageAnalysis';
import { useGetProcessingSettingsQuery } from '@/store/designSlice';
import type { ProjectIdea } from '../../gallery/types';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

interface UseWorkspaceGenerationParams {
  projectId: string;
  nicheId: string | null;
  /** Project slogan pool — feeds the Builder dialog's SloganPicker. */
  ideas?: ProjectIdea[];
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
  /**
   * FIX Item 4 — fired when the user manually flips the mode back to
   * `text_to_image` via the dropdown. `DesignWorkspaceView` wires this to
   * `artboardState.deselectAll` so the canvas selection clears when the
   * user manually reverts (AC-4-4).
   */
  onManualRevertToTextToImage?: () => void;
}

// FIX Item 4 — once-per-browser flag so the ">2 images" cap warning fires
// once. Same pattern as PR #103 `chat-search-mode-cost-warning-seen`.
const REFERENCE_CAP_WARNING_FLAG_KEY = 'mm-imagegen-cap-warning-seen';

const hasSeenReferenceCapWarning = (): boolean => {
  if (typeof window === 'undefined' || !window.localStorage) return true;
  try {
    return window.localStorage.getItem(REFERENCE_CAP_WARNING_FLAG_KEY) === '1';
  } catch {
    return true;
  }
};

const markReferenceCapWarningSeen = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(REFERENCE_CAP_WARNING_FLAG_KEY, '1');
  } catch {
    /* quota / privacy — ignore */
  }
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

const useWorkspaceGeneration = ({
  projectId,
  nicheId,
  ideas = [],
  boardDesigns,
  activeRuns,
  artboards,
  selectedArtboard,
  addArtboard,
  updateArtboard,
  pushHistory,
  hasSelectedImage,
  onManualRevertToTextToImage,
}: UseWorkspaceGenerationParams) => {
  // -- Prompt state --
  const [prompt, setPrompt] = useState('');
  const [aiModel, setAiModel] = useState<DesignModel>('google/gemini-3.1-flash-preview-image-generation');
  const [bgColor, setBgColor] = useState<BackgroundColor>('light_gray');
  const [imageCount, setImageCount] = useState(1);
  const [isParallel, setIsParallel] = useState(false);
  const [generationMode, setGenerationModeInternal] = useState<GenerationMode>('text_to_image');
  // FIX Item 4 — tracks whether the latest mode change came from the user
  // (`'manual'`) or from the selection-driven reflex (`'auto'`). Defaults to
  // `'manual'` since the initial state is "the panel boots in text-to-image
  // because that's the panel default, not because we derived it from any
  // selection".
  const [generationModeSource, setGenerationModeSource] = useState<'auto' | 'manual'>('manual');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [sourceImageUrl2, setSourceImageUrl2] = useState<string | null>(null);

  // -- AI generation --
  const generation = useGeneration(projectId);
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const failedRunHandledRef = useRef<Set<string>>(new Set());
  // FIX Item 4 — guards the cap-warning so it fires once per browser session
  // even if localStorage flag is wiped mid-session (matches the PR #103
  // pattern in `SearchDepthPicker`).
  const referenceCapWarningFiredRef = useRef<boolean>(hasSeenReferenceCapWarning());

  // -- Prompt Builder (PROJ-34 renovated) --
  const [promptBuilderOpen, setPromptBuilderOpen] = useState(false);

  // AC-40 / Appendix G — last polished output Builder inserted, compared
  // against current `prompt` on the next Build click to detect manual edits.
  // Held as state (not ref) so the dialog re-renders when dirtiness flips.
  const [lastBuildOutput, setLastBuildOutput] = useState<string | null>(null);
  const textareaDirtySinceBuild =
    lastBuildOutput !== null && lastBuildOutput !== prompt;

  // Workspace polish toggle (default ON when settings row not yet created).
  const { data: processingSettings } = useGetProcessingSettingsQuery();
  const polishEnabled =
    processingSettings?.polish_builder_prompts_enabled ?? true;

  const handleBuilderComplete = useCallback(
    (joinedPrompts: string) => {
      setPrompt(joinedPrompts);
      setLastBuildOutput(joinedPrompts);
      // AC-36: auto-flip Parallel Prompts ON when Builder produces ≥2 entries.
      if (joinedPrompts.includes(';')) setIsParallel(true);
      setPromptBuilderOpen(false);
    },
    [],
  );

  const builder = useBuilder({
    projectId,
    nicheId,
    backgroundColor: bgColor,
    polishEnabled,
    onBuildComplete: handleBuilderComplete,
  });

  // Pool lookup for the dialog → useBuilder bridge (id → slogan_text).
  const ideaPoolLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const idea of ideas) map.set(idea.id, idea.slogan_text);
    return map;
  }, [ideas]);

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

  // FIX Item 4 — public mode setter. Every manual switch atomically tags the
  // source as `'manual'` so the selection-driven reflex stops auto-reverting
  // (AC-4-5). When the user manually flips back to `text_to_image` we also
  // clear both reference slots AND fire the `onManualRevertToTextToImage`
  // callback so the parent can clear the canvas selection (AC-4-4).
  const setGenerationMode = useCallback(
    (mode: GenerationMode) => {
      setGenerationModeInternal(mode);
      setGenerationModeSource('manual');
      if (mode === 'text_to_image') {
        setSourceImageUrl(null);
        setSourceImageUrl2(null);
        onManualRevertToTextToImage?.();
      }
    },
    [onManualRevertToTextToImage],
  );

  // FIX Item 4 — selection-driven helper. Caps the incoming list at the
  // backend's 2-slot maximum (`source_image_url` + `source_image_url_2`) and
  // tags the resulting mode change as `'auto'` so the reflex hook knows to
  // revert when the selection empties. Fires a once-per-session warning when
  // the caller passed more than 2 URLs. Keeps `handleUseAsReference` (the
  // existing single-arg helper) untouched so the right-panel "Use as
  // reference" button keeps working unchanged (AC-4-2).
  const handleUseSelectionAsReferences = useCallback(
    (imageUrls: string[]) => {
      if (imageUrls.length === 0) return;
      const capped = imageUrls.slice(0, 2);
      setSourceImageUrl(capped[0] ?? null);
      setSourceImageUrl2(capped[1] ?? null);
      setGenerationModeInternal('image_to_image_edit');
      setGenerationModeSource('auto');
      if (imageUrls.length > 2 && !referenceCapWarningFiredRef.current) {
        referenceCapWarningFiredRef.current = true;
        markReferenceCapWarningSeen();
        enqueueSnackbar(
          t(
            'design.imageGen.references.capWarning',
            'Only the first 2 images are used as references',
          ),
          { variant: 'warning' },
        );
      }
    },
    [enqueueSnackbar, t],
  );

  // FIX Item 4 — counterpart to `handleUseSelectionAsReferences`: atomic
  // "drop the auto-derived references AND fall back to text-to-image" used
  // by the selection-driven reflex when the canvas selection empties.
  // Tagged `'auto'` so the badge stays visible until the user touches the
  // mode dropdown (which would flip the source to `'manual'`).
  const revertToTextToImage = useCallback(() => {
    setSourceImageUrl(null);
    setSourceImageUrl2(null);
    setGenerationModeInternal('text_to_image');
    setGenerationModeSource('auto');
  }, []);

  const handleOpenPromptBuilder = useCallback(() => {
    setPromptBuilderOpen(true);
  }, []);

  const handleClosePromptBuilder = useCallback(() => {
    setPromptBuilderOpen(false);
  }, []);

  const handleBuilderBuild = useCallback(
    async (config: Parameters<typeof builder.handleBuild>[0]) => {
      await builder.handleBuild(config, ideaPoolLookup);
    },
    [builder, ideaPoolLookup],
  );

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
      // FIX Item 4 — routes through the public wrapper so the "Use as
      // reference" right-panel button is correctly tagged as a manual mode
      // flip (source = 'manual'). Existing single-arg contract preserved.
      setGenerationMode('image_to_image_edit');
    }
  }, [generationMode, sourceImageUrl, sourceImageUrl2, setGenerationMode]);

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

  // PROJ-34 AC-37 \u2014 `;` is the single source of truth for multi-prompt splits.
  // The newline-based fallback is gone (Builder produces `; `-joined output;
  // free-typed multi-prompts must also use `;`). Empty entries are stripped.
  const parallelPrompts = useMemo<string[]>(
    () =>
      prompt
        .split(';')
        .map((p) => p.trim())
        .filter((p) => p.length > 0),
    [prompt],
  );
  const parallelLineCount = parallelPrompts.length;

  // Source URLs may be relative (/media/...) for local references; the
  // backend serializer requires absolute URLs.
  const toAbsolute = useCallback(
    (u: string | null) =>
      u && u.startsWith('/') ? `${window.location.origin}${u}` : u,
    [],
  );

  // Single low-level fire: skeleton + trigger one Run. Each parallel /
  // variant call goes through this so the skeleton-reconciliation effect
  // matches it up later via pendingRunId.
  const fireOne = useCallback(
    async (singlePrompt: string, label: string) => {
      const skeletonAb = addArtboard({
        label,
        kind: 'ai',
        width: 280,
        height: 280,
        isGenerating: true,
        promptUsed: singlePrompt,
        modelUsed: aiModel,
        bgColorUsed: bgColor,
      });
      try {
        const run = await generation.trigger({
          model: aiModel,
          background_color: bgColor,
          prompt: singlePrompt,
          mode: generationMode,
          aspect_ratio: aspectRatio,
          ...(sourceImageUrl
            ? { source_image_url: toAbsolute(sourceImageUrl) as string }
            : {}),
          ...(sourceImageUrl2
            ? { source_image_url_2: toAbsolute(sourceImageUrl2) as string }
            : {}),
        });
        updateArtboard(skeletonAb.id, { pendingRunId: run.id });
        return run;
      } catch {
        updateArtboard(skeletonAb.id, { isGenerating: false, pendingRunId: null });
        return null;
      }
    },
    [
      addArtboard, updateArtboard, generation, aiModel, bgColor,
      generationMode, aspectRatio, sourceImageUrl, sourceImageUrl2, toAbsolute,
    ],
  );

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || generation.isGenerating) return;
    pushHistory();

    // AC-39: single-prompt mode + Images > 1 \u2192 N parallel calls. Each call
    // is its own Run so the backend's run-id-derived seed (Appendix H)
    // automatically produces N distinct-but-reproducible variants.
    if (!isParallel && imageCount > 1) {
      const baseLabel = `AI: ${prompt.slice(0, 24)}${prompt.length > 24 ? '\u2026' : ''}`;
      await Promise.all(
        Array.from({ length: imageCount }, (_, i) =>
          // Soft suffix as a compositional nudge for models where similar
          // seeds still produce near-identical results; cost-free.
          fireOne(
            `${prompt} (variation ${i + 1} of ${imageCount})`,
            `${baseLabel} #${i + 1}`,
          ),
        ),
      );
      setSourceImageUrl(null);
      setSourceImageUrl2(null);
      return;
    }

    // Default single-shot fire.
    await fireOne(
      prompt,
      `AI: ${prompt.slice(0, 30)}${prompt.length > 30 ? '\u2026' : ''}`,
    );
    setSourceImageUrl(null);
    setSourceImageUrl2(null);
  }, [
    prompt, isParallel, imageCount, generation.isGenerating,
    pushHistory, fireOne,
  ]);

  // AC-37 / AC-36 \u2014 Generate-All: split the textarea on `;` and fire one
  // Run per entry. Used by the split-button menu when isParallel is ON and
  // \u2265 2 entries are present.
  const handleGenerateAll = useCallback(async () => {
    if (generation.isGenerating || parallelPrompts.length === 0) return;
    pushHistory();
    await Promise.all(
      parallelPrompts.map((p, i) =>
        fireOne(p, `AI: ${p.slice(0, 24)}${p.length > 24 ? '\u2026' : ''} #${i + 1}`),
      ),
    );
    setSourceImageUrl(null);
    setSourceImageUrl2(null);
  }, [generation.isGenerating, parallelPrompts, pushHistory, fireOne]);

  return {
    // Prompt state
    prompt, setPrompt,
    aiModel, setAiModel,
    bgColor, setBgColor,
    imageCount, setImageCount,
    isParallel, setIsParallel,
    generationMode, setGenerationMode,
    // FIX Item 4 — exposed so the right-panel can render the "Auto" badge
    // and the selection-driven reflex hook can short-circuit auto-revert
    // once the user touches the dropdown.
    generationModeSource,
    aspectRatio, setAspectRatio,
    sourceImageUrl,
    sourceImageUrl2,
    // Generation
    generation,
    handleGenerate,
    handleGenerateAll,
    parallelLineCount,
    // PROJ-34: Multi-Prompt Builder
    builder,
    promptBuilderOpen,
    handleOpenPromptBuilder,
    handleClosePromptBuilder,
    handleBuilderBuild,
    textareaDirtySinceBuild,
    // Image analysis
    imageAnalysis,
    hasSelectedImage,
    // Slogan/reference handlers
    handleInsertSlogan,
    handleUseAsReference,
    // FIX Item 4 — selection-driven multi-ref helper + atomic revert.
    handleUseSelectionAsReferences,
    revertToTextToImage,
    handleClearSourceImage,
    handleClearSourceImage2,
    handleUseAsPrompt,
    handleCreateSkeletonArtboards,
  };
};

export default useWorkspaceGeneration;
