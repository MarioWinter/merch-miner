import { useEffect } from 'react';
import type { Design } from '../../board/types';
import type { BatchImage } from '../types';

interface UseBoardDataDiffMergeArgs {
  serverDesigns: Design[] | undefined;
  setBatchImages: React.Dispatch<React.SetStateAction<BatchImage[]>>;
  loadImageMeta: (id: string, url: string) => void;
}

/**
 * Phase 8 — cross-tab diff merge for the editor batch.
 *
 * Replaces the prior one-time `hydratedRef.current` hydration with a
 * reconcile-on-every-change pass: a new design in another browser tab
 * appears here on the next `boardData.designs` update; a deleted design
 * is dropped; an in-place file-URL change refreshes the matching entry
 * without losing batch-local state (status, selection). Skips state
 * updates when nothing changed to avoid render churn (AC-7-10..AC-7-12).
 */
export const useBoardDataDiffMerge = ({
  serverDesigns,
  setBatchImages,
  loadImageMeta,
}: UseBoardDataDiffMergeArgs): void => {
  useEffect(() => {
    if (!serverDesigns) return;
    const serverIds = new Set(serverDesigns.map((d) => d.id));

    const newlyAppendedIds: Array<{ id: string; url: string }> = [];

    setBatchImages((prev) => {
      const filtered = prev.filter((bi) => !bi.designId || serverIds.has(bi.designId));

      const updated = filtered.map((bi) => {
        if (!bi.designId) return bi;
        const d = serverDesigns.find((sd) => sd.id === bi.designId);
        if (!d) return bi;
        const latestUrl = d.processed_file || d.bg_removed_file || d.image_file;
        const hasProcessing = !!(d.processed_file || d.bg_removed_file || d.upscaled_file);
        if (!latestUrl || latestUrl === bi.previewUrl) return bi;
        const url: string = latestUrl;
        return {
          ...bi,
          previewUrl: url,
          processedUrl: hasProcessing ? url : undefined,
          originalUrl: hasProcessing ? (d.image_file ?? undefined) : undefined,
          status: hasProcessing ? ('completed' as const) : bi.status,
        };
      });

      const existingIds = new Set(updated.map((bi) => bi.designId).filter(Boolean) as string[]);
      const appended: BatchImage[] = [];
      for (const d of serverDesigns) {
        if (!d.image_file) continue;
        if (existingIds.has(d.id)) continue;
        const latestUrl: string = d.processed_file || d.bg_removed_file || d.image_file;
        const hasProcessing = !!(d.processed_file || d.bg_removed_file || d.upscaled_file);
        appended.push({
          id: d.id,
          file: null,
          previewUrl: latestUrl,
          name: (d.image_file ?? '').split('/').pop() ?? 'design.png',
          status: hasProcessing ? ('completed' as const) : ('idle' as const),
          designId: d.id,
          originalUrl: hasProcessing ? (d.image_file ?? undefined) : undefined,
          processedUrl: hasProcessing ? latestUrl : undefined,
        });
        newlyAppendedIds.push({ id: d.id, url: latestUrl });
      }

      if (filtered.length === prev.length && appended.length === 0) {
        const sameRefs = updated.every((bi, i) => bi === filtered[i]);
        if (sameRefs) return prev;
        return updated;
      }
      return [...updated, ...appended];
    });

    newlyAppendedIds.forEach(({ id, url }) => {
      if (url) loadImageMeta(id, url);
    });
  }, [serverDesigns, loadImageMeta, setBatchImages]);
};

export default useBoardDataDiffMerge;
