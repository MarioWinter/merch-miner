import { useCallback, useState } from 'react';
import type { ArtboardData } from '../../board/types';

interface UseOptimisticArtboardUrlsArgs {
  artboards: ArtboardData[];
}

/**
 * Phase 9 — workspace-level optimistic overrides for artboard imageUrl.
 *
 * Map<artboardId, blobUrl> set immediately after a client-side pipeline
 * step completes (canvas updates within ~16ms) and cleared once the
 * server-side `saveProcessedImage` round-trip completes — at which point
 * the normal version-sync flow takes over.
 *
 * Returns:
 * - `optimisticArtboardUrls` — Map for `useArtboardVersionSync` to consume
 * - `handleOptimisticDesignUpdate(designId, url)` — caller-facing helper
 *   that resolves designId → all artboardIds linked to it and writes the
 *   override (or clears all entries when `url === null`).
 */
export const useOptimisticArtboardUrls = ({ artboards }: UseOptimisticArtboardUrlsArgs) => {
  const [optimisticArtboardUrls, setMap] = useState<Map<string, string>>(() => new Map());

  const setOptimisticArtboardUrl = useCallback(
    (artboardId: string, url: string | null) => {
      setMap((prev) => {
        const next = new Map(prev);
        if (url === null) next.delete(artboardId);
        else next.set(artboardId, url);
        return next;
      });
    },
    [],
  );

  const handleOptimisticDesignUpdate = useCallback(
    (designId: string, url: string | null) => {
      const matchingArtboardIds = artboards
        .filter((ab) => ab.designId === designId)
        .map((ab) => ab.id);
      for (const artboardId of matchingArtboardIds) {
        setOptimisticArtboardUrl(artboardId, url);
      }
    },
    [artboards, setOptimisticArtboardUrl],
  );

  return {
    optimisticArtboardUrls,
    handleOptimisticDesignUpdate,
  };
};

export default useOptimisticArtboardUrls;
