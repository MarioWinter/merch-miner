// PROJ-34 — wiring hook for the renovated Multi-Prompt Builder.
//
// Replaces the old usePromptBuilder hook for callers using <BuilderDialog />.
// Owns: BuilderPreset CRUD + the /builder/build/ POST + the manual-edit
// tracking ref + niche-context reason resolution.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSnackbar } from 'notistack';
import {
  useBuilderBuildMutation,
  useCreateBuilderPresetMutation,
  useDeleteBuilderPresetMutation,
  useGetNicheHintsQuery,
  useListBuilderPresetsQuery,
  type BuilderFormHints,
} from '@/store/designSlice';
import { researchApi } from '@/views/niches/research/services/researchApi';
import type {
  BackgroundColorSlug,
  BuilderConfig,
  BuilderPresetSummary,
  NicheContextReason,
} from '../types/builder';

interface UseBuilderParams {
  projectId: string;
  nicheId: string | null;
  /** Current bg color picked in the GenerationZone — Builder mirrors it. */
  backgroundColor: BackgroundColorSlug;
  /** Workspace polish toggle (read from ProcessingSettings in the parent). */
  polishEnabled: boolean;
  /** Called with `; `-joined polished prompts; parent inserts into textarea. */
  onBuildComplete: (joinedPrompts: string) => void;
}

const splitFreeText = (raw: string): string[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const dedupeCaseInsensitive = (items: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

export const useBuilder = ({
  projectId,
  nicheId,
  backgroundColor,
  polishEnabled,
  onBuildComplete,
}: UseBuilderParams) => {
  const { enqueueSnackbar } = useSnackbar();

  // RTK Query
  const [buildPrompts, { isLoading: isBuilding }] = useBuilderBuildMutation();
  const { data: rawPresets = [] } = useListBuilderPresetsQuery(projectId, {
    skip: !projectId,
  });
  const [createPreset] = useCreateBuilderPresetMutation();
  const [deletePreset] = useDeleteBuilderPresetMutation();

  // PROJ-34 Phase 13g — niche-hints used by BuilderDialog to pre-fill the
  // form-based slots when the user hasn't typed anything yet (AC-66). Skipped
  // until projectId is known so we don't hit the API with an empty string.
  const { data: nicheHintsData } = useGetNicheHintsQuery(
    { projectId },
    { skip: !projectId },
  );
  const nicheHints: BuilderFormHints | null =
    nicheHintsData?.builder_form_hints ?? null;

  // Map API rows to the dialog's BuilderPresetSummary shape.
  const presets = useMemo<BuilderPresetSummary[]>(
    () =>
      rawPresets.map((row) => ({
        id: row.id,
        name: row.name,
        config: row.config as unknown as BuilderConfig,
      })),
    [rawPresets],
  );

  // -- Niche-context reason resolution (EC-16 / EC-23) --
  // Fires a one-shot fetch of the latest research per niche. We key the
  // cached result by nicheId so a niche switch doesn't briefly show stale
  // "has-research=true" while the new fetch is in flight.
  const [research, setResearch] = useState<{ nicheId: string; value: boolean } | null>(
    null,
  );
  useEffect(() => {
    if (!nicheId) return;
    if (research?.nicheId === nicheId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await researchApi.getLatestResearch(nicheId);
        if (cancelled) return;
        const hasAny = Boolean(
          data?.analysis || (data?.products ?? []).length > 0,
        );
        setResearch({ nicheId, value: hasAny });
      } catch {
        if (!cancelled) setResearch({ nicheId, value: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nicheId, research]);

  const nicheReason = useMemo<NicheContextReason>(() => {
    if (!nicheId) return { disabled: true, reasonKey: 'noNiche' };
    if (research?.nicheId === nicheId && research.value === false) {
      return { disabled: true, reasonKey: 'noResearch' };
    }
    if (research?.nicheId === nicheId && research.value === true) {
      return { disabled: false, reasonKey: null };
    }
    // Still loading — conservatively keep enabled so user can toggle; backend
    // is the final guard (request flag is ignored when no research exists).
    return { disabled: false, reasonKey: null };
  }, [nicheId, research]);

  // -- Build action --
  const handleBuild = useCallback(
    async (
      config: BuilderConfig,
      poolLookup: Map<string, string>, // idea_id → slogan_text
    ) => {
      const fromPool = config.selectedSloganIds
        .map((id) => poolLookup.get(id))
        .filter((s): s is string => Boolean(s));
      const fromText = splitFreeText(config.freeTextSlogans);
      const slogans = dedupeCaseInsensitive([...fromPool, ...fromText]);

      if (slogans.length === 0 || config.selectedStyleSlugs.length === 0) {
        return;
      }

      try {
        const result = await buildPrompts({
          projectId,
          body: {
            slogans,
            styles: config.selectedStyleSlugs,
            background_color: backgroundColor,
            with_polish: polishEnabled,
            include_niche_context:
              config.includeNicheContext && !nicheReason.disabled,
          },
        }).unwrap();
        // AC-36: join with `;` separator; parent inserts + flips parallel on.
        onBuildComplete(result.prompts.join('; '));
      } catch {
        enqueueSnackbar('Failed to build prompts', { variant: 'error' });
      }
    },
    [
      buildPrompts,
      projectId,
      backgroundColor,
      polishEnabled,
      nicheReason.disabled,
      onBuildComplete,
      enqueueSnackbar,
    ],
  );

  // -- Preset CRUD wrappers --
  const handleSavePreset = useCallback(
    async (name: string, config: BuilderConfig) => {
      try {
        await createPreset({
          projectId,
          body: { name, config: config as unknown as Record<string, unknown> },
        }).unwrap();
        enqueueSnackbar('Preset saved', { variant: 'success' });
      } catch {
        enqueueSnackbar('Failed to save preset (duplicate name?)', {
          variant: 'error',
        });
      }
    },
    [createPreset, projectId, enqueueSnackbar],
  );

  const handleDeletePreset = useCallback(
    async (presetId: string) => {
      try {
        await deletePreset({ projectId, presetId }).unwrap();
        enqueueSnackbar('Preset deleted', { variant: 'success' });
      } catch {
        enqueueSnackbar('Failed to delete preset', { variant: 'error' });
      }
    },
    [deletePreset, projectId, enqueueSnackbar],
  );

  return {
    presets,
    nicheReason,
    isBuilding,
    nicheHints,
    handleBuild,
    handleSavePreset,
    handleDeletePreset,
  };
};

export default useBuilder;
