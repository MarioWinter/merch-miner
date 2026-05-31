import { useEffect } from 'react';
import type { ArtboardData, CanvasElement, Design } from '../types';

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
 * Returns a NEW layers array where the FIRST `type === 'image'` layer has its
 * `props.src` set to `newSrc`. All other layers (text/shape/brush/emoji) are
 * passed through unchanged by reference. Returns `null` when no image layer
 * exists (caller decides to omit the layers patch entirely — hydration owns
 * image-layer creation, this hook never fabricates one).
 *
 * Pure: never mutates the input array or any layer object.
 */
const withLayerSrcPatched = (
  layers: CanvasElement[],
  newSrc: string,
): CanvasElement[] | null => {
  const idx = layers.findIndex((l) => l.type === 'image');
  if (idx === -1) return null;
  const target = layers[idx] as CanvasElement<'image'>;
  if (target.props.src === newSrc) return null;
  const patched: CanvasElement<'image'> = {
    ...target,
    props: { ...target.props, src: newSrc },
  };
  const next = layers.slice();
  next[idx] = patched;
  return next;
};

/**
 * Builds + dispatches a single coherent `updateArtboard` patch:
 * - always sets `imageUrl` to the resolved URL (when it differs)
 * - additionally patches the FIRST image-layer's `props.src` to the same URL
 *   so the Konva render (which reads `element.props.src`) reflects the active
 *   version. Both fields go in one call so React sees one state transition.
 *
 * No-ops when neither field would change — preserves the prior "skip identical
 * updates" behavior to avoid render loops.
 */
const applyResolvedUrl = (
  ab: ArtboardData,
  resolved: string,
  updateArtboard: (id: string, patch: Partial<ArtboardData>) => void,
): void => {
  const urlChanged = resolved !== ab.imageUrl;
  const nextLayers = withLayerSrcPatched(ab.layers, resolved);
  if (!urlChanged && !nextLayers) return;
  const patch: Partial<ArtboardData> = {};
  if (urlChanged) patch.imageUrl = resolved;
  if (nextLayers) patch.layers = nextLayers;
  updateArtboard(ab.id, patch);
};

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
        applyResolvedUrl(ab, optimistic, updateArtboard);
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
      applyResolvedUrl(ab, resolved, updateArtboard);
    }
  }, [artboards, designsById, userPickedVersions, updateArtboard, optimisticArtboardUrls]);
};

export default useArtboardVersionSync;
