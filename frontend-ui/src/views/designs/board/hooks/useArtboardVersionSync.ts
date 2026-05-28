import { useEffect } from 'react';
import type { ArtboardData, Design } from '../types';

export type VersionSlot = 'original' | 'processed' | 'bg_removed' | 'upscaled';

interface UseArtboardVersionSyncParams {
  artboards: ArtboardData[];
  designsById: Map<string, Design>;
  userPickedVersions: Map<string, VersionSlot>;
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void;
  /**
   * Phase 9 — per-artboard optimistic URL overrides. Highest priority: when
   * an entry exists for `artboard.id`, that URL is written to `imageUrl`
   * regardless of user picks or auto-priority resolution. Cleared by the
   * caller once the server-side save round-trip completes (or fails).
   */
  optimisticArtboardUrls?: Map<string, string>;
}

const resolveSlotUrl = (design: Design, slot: VersionSlot): string => {
  switch (slot) {
    case 'upscaled':
      return design.upscaled_file ?? '';
    case 'bg_removed':
      return design.bg_removed_file ?? '';
    case 'processed':
      return design.processed_file ?? '';
    case 'original':
      return design.image_file ?? '';
  }
};

const resolveLatestUrl = (design: Design): string =>
  design.upscaled_file ||
  design.bg_removed_file ||
  design.processed_file ||
  design.image_file ||
  '';

/**
 * Keeps each linked artboard's `imageUrl` in sync with the resolved Design
 * version. Priority order is `upscaled > bg_removed > processed > image_file`,
 * unless the user has explicitly picked a slot via the version picker.
 */
export const useArtboardVersionSync = ({
  artboards,
  designsById,
  userPickedVersions,
  updateArtboard,
  optimisticArtboardUrls,
}: UseArtboardVersionSyncParams): void => {
  useEffect(() => {
    for (const ab of artboards) {
      // Optimistic override beats both user pick and auto-priority resolution.
      const optimistic = optimisticArtboardUrls?.get(ab.id);
      if (optimistic) {
        if (optimistic !== ab.imageUrl) {
          updateArtboard(ab.id, { imageUrl: optimistic });
        }
        continue;
      }
      if (!ab.designId) continue;
      const design = designsById.get(ab.designId);
      if (!design) continue;
      const pickedSlot = userPickedVersions.get(ab.designId);
      const resolved = pickedSlot
        ? resolveSlotUrl(design, pickedSlot)
        : resolveLatestUrl(design);
      if (!resolved) continue;
      if (resolved !== ab.imageUrl) {
        updateArtboard(ab.id, { imageUrl: resolved });
      }
    }
  }, [artboards, designsById, userPickedVersions, updateArtboard, optimisticArtboardUrls]);
};

export default useArtboardVersionSync;
