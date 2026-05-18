// PROJ-34 Phase 13g — dialog-local state for the renovated BuilderDialog.
//
// Owns: BuilderConfig (cfg) + per-slot dirty flags + niche-hints pre-fill
// effect (AC-66) + EC-28 override-wins behavior + preset load with v1→v2
// compatibility (AC-68 + EC-25).

import { useCallback, useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { STYLE_LIBRARY } from '../constants/styleLibrary';
import {
  EMPTY_BUILDER_CONFIG,
  type BuilderConfig,
  type BuilderPresetSummary,
  type BuilderSlots,
} from '../types/builder';
import type { BuilderFormHints } from '@/store/designSlice';
import type { ProjectIdea } from '@/views/designs/gallery/types';

export type DirtySlots = Partial<Record<keyof BuilderSlots, boolean>>;

interface UseBuilderDialogStateParams {
  ideas: ProjectIdea[];
  presets: BuilderPresetSummary[];
  nicheHints: BuilderFormHints | null;
}

const HINT_TO_SLOT: Array<[keyof BuilderSlots, keyof BuilderFormHints]> = [
  ['spatial_configuration', 'spatial'],
  ['visual_description', 'visual'],
  ['accessories', 'accessories'],
  ['material_texture', 'material'],
];

export const useBuilderDialogState = ({
  ideas,
  presets,
  nicheHints,
}: UseBuilderDialogStateParams) => {
  const { enqueueSnackbar } = useSnackbar();
  const [cfg, setCfg] = useState<BuilderConfig>(EMPTY_BUILDER_CONFIG);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [dirtySlots, setDirtySlots] = useState<DirtySlots>({});

  // AC-66 — niche-hints pre-fill. Only fills empty + non-dirty slots so the
  // user's typed overrides always win (EC-28).
  useEffect(() => {
    if (!nicheHints) return;
    setCfg((prev) => {
      const next: BuilderSlots = { ...prev.slots };
      let changed = false;
      for (const [slotKey, hintKey] of HINT_TO_SLOT) {
        const hintValue = nicheHints[hintKey];
        if (typeof hintValue !== 'string' || hintValue.length === 0) continue;
        const current = next[slotKey];
        if (current && current.length > 0) continue;
        if (dirtySlots[slotKey]) continue;
        next[slotKey] = hintValue;
        changed = true;
      }
      if (!changed) return prev;
      return { ...prev, slots: next };
    });
  }, [nicheHints, dirtySlots]);

  // EC-28 — every user edit flips the dirty flag so subsequent style switches
  // do NOT silently replace the typed value.
  const updateSlot = useCallback(
    (key: keyof BuilderSlots, value: string) => {
      setCfg((prev) => ({
        ...prev,
        slots: { ...prev.slots, [key]: value },
      }));
      setDirtySlots((prev) => ({ ...prev, [key]: true }));
    },
    [],
  );

  // Reset clears the dirty flag so the next style change / niche hint can fill
  // the slot again.
  const resetSlot = useCallback((key: keyof BuilderSlots) => {
    setCfg((prev) => ({
      ...prev,
      slots: { ...prev.slots, [key]: '' },
    }));
    setDirtySlots((prev) => {
      const { [key]: _omit, ...rest } = prev;
      void _omit;
      return rest;
    });
  }, []);

  const setStyleSlugs = useCallback((slugs: string[]) => {
    setCfg((prev) => ({ ...prev, selectedStyleSlugs: slugs }));
  }, []);

  const toggleStyle = useCallback((slug: string) => {
    setCfg((prev) => {
      const next = prev.selectedStyleSlugs.includes(slug)
        ? prev.selectedStyleSlugs.filter((s) => s !== slug)
        : [...prev.selectedStyleSlugs, slug];
      return { ...prev, selectedStyleSlugs: next };
    });
  }, []);

  // AC-68 + EC-25 — v1 presets stored before Phase 13e omit the `slots`
  // sub-object. We default it to `{}` so the backend fallback chain
  // (`niche-hint → style-default → omit`) fires.
  const loadPreset = useCallback(
    (id: string) => {
      if (!id) {
        setSelectedPresetId(null);
        return;
      }
      const preset = presets.find((p) => p.id === id);
      if (!preset) return;
      setSelectedPresetId(id);

      const merged: BuilderConfig = {
        ...EMPTY_BUILDER_CONFIG,
        ...preset.config,
        slots: { ...EMPTY_BUILDER_CONFIG.slots, ...(preset.config.slots ?? {}) },
      };

      // EC-14 / EC-15 — drop stale slogan_ids and unknown style slugs.
      const knownIdeaIds = new Set(ideas.map((i) => i.id));
      const knownStyleSlugs = new Set(STYLE_LIBRARY.map((s) => s.slug));

      const filteredIdeas = merged.selectedSloganIds.filter((ideaId) =>
        knownIdeaIds.has(ideaId),
      );
      const filteredStyles = merged.selectedStyleSlugs.filter((slug) =>
        knownStyleSlugs.has(slug),
      );

      const droppedIdeas =
        merged.selectedSloganIds.length - filteredIdeas.length;
      const droppedStyles =
        merged.selectedStyleSlugs.length - filteredStyles.length;
      const droppedTotal = droppedIdeas + droppedStyles;
      if (droppedTotal > 0) {
        enqueueSnackbar(
          `${droppedTotal} item(s) from this preset were skipped because they no longer exist`,
          { variant: 'warning' },
        );
      }

      setCfg({
        ...merged,
        selectedSloganIds: filteredIdeas,
        selectedStyleSlugs: filteredStyles,
      });
      // Reset dirty state — preset-loaded slots are considered the new baseline.
      setDirtySlots({});
    },
    [presets, ideas, enqueueSnackbar],
  );

  return {
    cfg,
    setCfg,
    dirtySlots,
    selectedPresetId,
    updateSlot,
    resetSlot,
    setStyleSlugs,
    toggleStyle,
    loadPreset,
  };
};

export default useBuilderDialogState;
