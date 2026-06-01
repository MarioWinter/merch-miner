/**
 * FIX-canvas-editor-bugs-and-image-gen — Item 4 reflex hook.
 *
 * Subscribes to the canvas `selectedIds` set and drives the AI Image-Gen
 * panel automatically:
 *
 *   - Empty -> selection with 1+ image artboards:
 *       calls `handleUseSelectionAsReferences(imageUrls)` which caps to 2,
 *       writes both reference slots, flips mode to `image_to_image_edit`,
 *       and tags the source as `'auto'`.
 *
 *   - Non-empty -> empty AND mode source is `'auto'`:
 *       calls `revertToTextToImage` which clears refs + sets mode to
 *       `text_to_image` (still tagged `'auto'` so the Auto badge sticks
 *       until the user touches the dropdown).
 *
 * Edge cases:
 *   - Remix mode: short-circuits (existing 2-slot remix UX handles its own
 *     reference plumbing — EC-4-4).
 *   - Generation in flight: short-circuits the cycle so we don't change
 *     references for the request currently posting (EC-4-3).
 *   - Mixed selection (text/shape artboards alongside image ones): the
 *     non-image entries are filtered out at build time (EC-4-1). When the
 *     filter leaves zero, no mode switch fires.
 *   - Deleted designs: an artboard whose `designId` is null OR whose
 *     `imageUrl` is null is treated as non-image and skipped (EC-4-5).
 *
 * The hook uses a `previousSignatureRef` to fire ONLY when the actual
 * selected-id set transitions — not on every artboards-array mutation.
 */
import { useEffect, useRef } from 'react';
import type { ArtboardData, GenerationMode } from '../../board/types';

interface UseSelectionDrivenImageGenParams {
  selectedIds: Set<string>;
  artboards: ArtboardData[];
  generationMode: GenerationMode;
  generationModeSource: 'auto' | 'manual';
  isGenerationInFlight: boolean;
  handleUseSelectionAsReferences: (imageUrls: string[]) => void;
  revertToTextToImage: () => void;
}

const buildSelectionSignature = (ids: Set<string>): string => {
  if (ids.size === 0) return '';
  // Sorted so re-ordering insertion (unlikely with Set) is treated as the
  // same selection. Stable key for the previous-vs-current diff.
  return [...ids].sort().join('|');
};

const useSelectionDrivenImageGen = ({
  selectedIds,
  artboards,
  generationMode,
  generationModeSource,
  isGenerationInFlight,
  handleUseSelectionAsReferences,
  revertToTextToImage,
}: UseSelectionDrivenImageGenParams): void => {
  // Tracks the last selection signature we ACTED on. Initialised to a value
  // that matches the boot-time empty selection so the first effect cycle
  // with `selectedIds.size === 0` does not no-op fire `revertToTextToImage`
  // (we only react to changes, not to initial mount with no selection).
  const previousSignatureRef = useRef<string>(buildSelectionSignature(selectedIds));

  useEffect(() => {
    const signature = buildSelectionSignature(selectedIds);
    if (signature === previousSignatureRef.current) return;

    // EC-4-4 — Remix mode owns its own 2-slot reference handling. Do not
    // override it from selection. Treat this cycle as observed (so when the
    // user later flips OUT of remix the next selection change still fires).
    if (generationMode === 'remix') {
      previousSignatureRef.current = signature;
      return;
    }

    // EC-4-3 — Don't move references while a generation is currently
    // posting. We deliberately do NOT update the ref so the next render
    // (once the request settles) can act on this same selection.
    if (isGenerationInFlight) return;

    if (selectedIds.size > 0) {
      // Build image URLs in selection-iteration order. Filter to image-
      // bearing artboards only (EC-4-1 + EC-4-5: skip non-image and skip
      // artboards whose linked design has gone away).
      const byId = new Map<string, ArtboardData>();
      for (const ab of artboards) byId.set(ab.id, ab);

      const imageUrls: string[] = [];
      for (const id of selectedIds) {
        const ab = byId.get(id);
        if (!ab) continue;
        if (!ab.designId) continue;
        if (!ab.imageUrl) continue;
        imageUrls.push(ab.imageUrl);
      }

      if (imageUrls.length === 0) {
        // EC-4-1 — nothing image-bearing in the selection: no mode switch.
        previousSignatureRef.current = signature;
        return;
      }

      handleUseSelectionAsReferences(imageUrls);
      previousSignatureRef.current = signature;
      return;
    }

    // Selection emptied. Only auto-revert when the latest mode change was
    // OUR own — never override a user-set mode (AC-4-3).
    if (
      generationModeSource === 'auto' &&
      generationMode !== 'text_to_image'
    ) {
      revertToTextToImage();
    }
    previousSignatureRef.current = signature;
  }, [
    selectedIds,
    artboards,
    generationMode,
    generationModeSource,
    isGenerationInFlight,
    handleUseSelectionAsReferences,
    revertToTextToImage,
  ]);
};

export default useSelectionDrivenImageGen;
