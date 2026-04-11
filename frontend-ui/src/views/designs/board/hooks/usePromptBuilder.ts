import { useState, useCallback, useMemo, useRef } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import {
  useBuildPromptsMutation,
  useCreatePromptsMutation,
  useListPromptPresetsQuery,
  useCreatePromptPresetMutation,
  useDeletePromptPresetMutation,
} from '@/store/designSlice';
import { useListNicheKeywordsQuery } from '@/store/keywordSlice';
import { researchApi } from '@/views/niches/research/services/researchApi';
import type { NicheResearchRun } from '@/views/niches/research/types';
import type { ProjectReference, BuildPromptsBody } from '../../gallery/types';
import type { ReferenceToggle } from '../partials/promptBuilder/ContextTab';

// -----------------------------------------------------------------
// Types
// -----------------------------------------------------------------

export interface SourceToggles {
  slogan: boolean;
  keywords: boolean;
  research: boolean;
  web_research: boolean;
  image: boolean;
}

const DEFAULT_SOURCES: SourceToggles = {
  slogan: true,
  keywords: false,
  research: false,
  web_research: false,
  image: false,
};

// -----------------------------------------------------------------
// Hook
// -----------------------------------------------------------------

export const usePromptBuilder = (projectId: string, nicheId: string | null) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [buildPrompts] = useBuildPromptsMutation();
  const [createPrompts, { isLoading: isSaving }] = useCreatePromptsMutation();
  const { data: presets = [] } = useListPromptPresetsQuery();
  const [createPreset] = useCreatePromptPresetMutation();
  const [removePreset] = useDeletePromptPresetMutation();

  // -- Dialog state --
  const [sources, setSources] = useState<SourceToggles>({ ...DEFAULT_SOURCES });
  const [selectedSloganId, setSelectedSloganId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState(1);
  const [preview, setPreview] = useState<string[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Track bulk slogans (when opened with multiple selected)
  const [bulkSloganIds, setBulkSloganIds] = useState<string[]>([]);

  // Reference data for prompt building
  const referenceTogglesRef = useRef<ReferenceToggle[]>([]);
  const referencesRef = useRef<ProjectReference[]>([]);

  // Debounce timer for preview
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasNiche = Boolean(nicheId);

  /** Update reference data before building (called from dialog) */
  const setReferenceData = useCallback(
    (toggles: ReferenceToggle[], refs: ProjectReference[]) => {
      referenceTogglesRef.current = toggles;
      referencesRef.current = refs;
    },
    [],
  );

  /** Resolve enabled references into image URLs and analysis texts */
  const resolveReferences = useCallback(() => {
    const imageUrls: string[] = [];
    const analysisTexts: string[] = [];

    for (const toggle of referenceTogglesRef.current) {
      if (!toggle.enabled) continue;
      const ref = referencesRef.current.find((r) => r.id === toggle.referenceId);
      if (!ref) continue;

      if (toggle.mode === 'image') {
        imageUrls.push(ref.image_url);
      } else if (toggle.mode === 'text') {
        const pa = ref.prompt_analysis as Record<string, unknown> | null;
        const text = pa?.summary as string ?? pa?.final_prompt as string ?? null;
        if (text) analysisTexts.push(text);
      }
    }
    return { imageUrls, analysisTexts };
  }, []);

  // -- Fetch niche keywords (Gap 5) --
  const { data: keywordsData } = useListNicheKeywordsQuery(
    { nicheId: nicheId ?? '', page_size: 50 },
    { skip: !nicheId },
  );
  const nicheKeywords = useMemo(
    () => keywordsData?.results?.map((k) => k.keyword) ?? [],
    [keywordsData],
  );

  // -- Fetch niche research data (Gap 6) --
  const [researchData, setResearchData] = useState<NicheResearchRun | null>(null);
  const [isResearchLoading, setIsResearchLoading] = useState(false);
  const fetchedResearchNicheRef = useRef<string | null>(null);

  // Fetch research when nicheId changes
  const fetchResearchData = useCallback(async () => {
    if (!nicheId || fetchedResearchNicheRef.current === nicheId) return;
    fetchedResearchNicheRef.current = nicheId;
    setIsResearchLoading(true);
    try {
      const data = await researchApi.getLatestResearch(nicheId);
      setResearchData(data);
    } catch {
      setResearchData(null);
    } finally {
      setIsResearchLoading(false);
    }
  }, [nicheId]);

  // Trigger fetch on mount / nicheId change
  if (nicheId && fetchedResearchNicheRef.current !== nicheId) {
    void fetchResearchData();
  }

  // Extract research preview fields
  const researchPreview = useMemo(() => {
    if (!researchData) return null;
    const products = researchData.products ?? [];
    const firstVision = products.find((p) => p.vision_analysis)?.vision_analysis;
    const firstEmotional = products.find((p) => p.emotional_analysis)?.emotional_analysis;
    const analysis = researchData.analysis;
    return {
      visual_style: firstVision?.visual_style ?? null,
      graphic_elements: firstVision?.graphic_elements ?? null,
      vibe: firstEmotional?.vibe ?? null,
      tone: firstEmotional?.tone ?? null,
      dominant_aesthetics: analysis?.dominant_design_aesthetics ?? null,
    };
  }, [researchData]);

  const toggleSource = useCallback((key: keyof SourceToggles) => {
    setSources((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // -- Fetch preview (debounced) --
  const fetchPreview = useCallback(
    async (currentSources: SourceToggles, sloganId: string | null, img: string | null, variantCount: number) => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);

      // Need at least one source enabled
      const hasAnySource = Object.values(currentSources).some(Boolean);
      if (!hasAnySource) {
        setPreview([]);
        return;
      }

      previewTimerRef.current = setTimeout(async () => {
        setIsPreviewLoading(true);
        try {
          const body: BuildPromptsBody = {
            sources: currentSources,
            variants: variantCount,
            ...(sloganId && { slogan_id: sloganId }),
            ...(img && { image_url: img }),
          };
          const result = await buildPrompts({ projectId, body }).unwrap();
          setPreview(result.prompts.map((p) => p.prompt_text));
        } catch {
          // Silent fail for preview
          setPreview([]);
        } finally {
          setIsPreviewLoading(false);
        }
      }, 500);
    },
    [buildPrompts, projectId],
  );

  // -- Apply preset (pass-through — dialog calls loadTabConfig directly) --
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const applyPreset = useCallback((_config: Record<string, unknown>) => undefined, []);

  // -- Save preset (receives full tab config from dialog) --
  const savePreset = useCallback(
    async (name: string, tabConfig: Record<string, unknown>) => {
      try {
        await createPreset({ name, source_config: tabConfig }).unwrap();
        enqueueSnackbar(t('design.presets.saved', 'Preset saved'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('design.presets.saveError', 'Failed to save preset'), { variant: 'error' });
      }
    },
    [createPreset, enqueueSnackbar, t],
  );

  // -- Delete preset --
  const deletePreset = useCallback(
    async (presetId: string) => {
      try {
        await removePreset(presetId).unwrap();
        enqueueSnackbar(t('design.presets.deleted', 'Preset deleted'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('design.presets.deleteError', 'Failed to delete preset'), { variant: 'error' });
      }
    },
    [removePreset, enqueueSnackbar, t],
  );

  // -- Build & save prompts --
  const buildAndSave = useCallback(async () => {
    const sloganIds = bulkSloganIds.length > 0 ? bulkSloganIds : (selectedSloganId ? [selectedSloganId] : [null]);

    // Resolve enabled reference images/texts
    const { imageUrls, analysisTexts } = resolveReferences();

    const allPrompts: Array<{
      prompt_text: string;
      sources: Record<string, boolean>;
      source_idea?: string;
      source_image_url?: string;
      variant_index?: number;
    }> = [];

    for (const sId of sloganIds) {
      const body: BuildPromptsBody = {
        sources,
        variants,
        ...(sId && { slogan_id: sId }),
        ...(imageUrl && { image_url: imageUrl }),
        ...(imageUrls.length > 0 && { source_image_urls: imageUrls }),
        ...(analysisTexts.length > 0 && { reference_analysis_texts: analysisTexts }),
      };

      try {
        const result = await buildPrompts({ projectId, body }).unwrap();
        result.prompts.forEach((p, idx) => {
          allPrompts.push({
            prompt_text: p.prompt_text,
            sources: p.sources,
            ...(sId && { source_idea: sId }),
            ...(imageUrl && { source_image_url: imageUrl }),
            variant_index: idx,
          });
        });
      } catch {
        enqueueSnackbar(t('design.promptBuilder.buildError', 'Failed to build prompts'), {
          variant: 'error',
        });
        return;
      }
    }

    if (allPrompts.length === 0) return;

    try {
      await createPrompts({ projectId, body: { prompts: allPrompts } }).unwrap();
      enqueueSnackbar(
        t('design.promptBuilder.buildSuccess', '{{count}} prompt(s) saved', {
          count: allPrompts.length,
        }),
        { variant: 'success' },
      );
    } catch {
      enqueueSnackbar(t('design.promptBuilder.saveError', 'Failed to save prompts'), {
        variant: 'error',
      });
    }
  }, [bulkSloganIds, selectedSloganId, sources, variants, imageUrl, buildPrompts, createPrompts, projectId, enqueueSnackbar, t, resolveReferences]);

  // -- Open helpers --
  const openForSlogans = useCallback(
    (sloganIds: string[]) => {
      setBulkSloganIds(sloganIds);
      if (sloganIds.length === 1) setSelectedSloganId(sloganIds[0]);
      else setSelectedSloganId(null);
      setSources({ ...DEFAULT_SOURCES, slogan: true });
      setVariants(1);
      setPreview([]);
      setImageUrl(null);
    },
    [],
  );

  const reset = useCallback(() => {
    setSources({ ...DEFAULT_SOURCES });
    setSelectedSloganId(null);
    setImageUrl(null);
    setVariants(1);
    setPreview([]);
    setBulkSloganIds([]);
  }, []);

  return {
    // State
    sources,
    selectedSloganId,
    imageUrl,
    variants,
    preview,
    isPreviewLoading,
    isSaving,
    hasNiche,
    presets,
    bulkSloganIds,
    nicheKeywords,
    researchPreview,
    isResearchLoading,
    // Actions
    setReferenceData,
    toggleSource,
    setSelectedSloganId,
    setImageUrl,
    setVariants,
    fetchPreview,
    applyPreset,
    savePreset,
    deletePreset,
    buildAndSave,
    openForSlogans,
    reset,
  };
};
