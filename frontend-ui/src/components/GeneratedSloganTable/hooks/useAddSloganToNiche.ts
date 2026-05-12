/**
 * PROJ-29 Phase 1H-2 — Add-to-Niche mutation wrapper for GeneratedSloganTable.
 *
 * Wraps `useCreateIdeaMutation` with row-status tracking so the table can show
 * per-row spinner / ✓ / ⚠ / ✗ icons. Sequential bulk-add (not parallel) keeps
 * the backend rate-throttle happy and gives visible per-row feedback.
 */
import { useCallback, useState } from 'react';
import { useCreateIdeaMutation } from '@/store/ideaSlice';
import type { IdeaCreateBody } from '@/views/ideas/types';
import type { SloganRow, RowStatus } from '../types/slogan';

const emotionalArchetypeToString = (value: SloganRow['emotional_archetype']) =>
  Array.isArray(value) ? value.join(', ') : (value ?? '');

const buildBody = (row: SloganRow, nicheId: string): IdeaCreateBody => ({
  slogan_text: row.slogan_text,
  niche: nicheId,
  signal_type: row.signal_type,
  pattern_used: row.pattern_used,
  stylistic_device: row.stylistic_device,
  emotional_archetype: emotionalArchetypeToString(row.emotional_archetype),
  market_confidence: row.market_confidence,
  creative_modules_used: ['chat_agent', ...(row.creative_modules_used ?? [])],
  status: 'approved',
});

export interface AddSloganApi {
  statusByIndex: Record<number, RowStatus>;
  addRow: (idx: number, row: SloganRow, nicheId: string) => Promise<RowStatus>;
  addMany: (
    indexes: ReadonlyArray<number>,
    rows: ReadonlyArray<SloganRow>,
    nicheId: string,
  ) => Promise<void>;
  reset: () => void;
}

export const useAddSloganToNiche = (): AddSloganApi => {
  const [statusByIndex, setStatusByIndex] = useState<Record<number, RowStatus>>(
    {},
  );
  const [createIdea] = useCreateIdeaMutation();

  const setRow = useCallback((idx: number, status: RowStatus) => {
    setStatusByIndex((prev) => ({ ...prev, [idx]: status }));
  }, []);

  const addRow = useCallback(
    async (idx: number, row: SloganRow, nicheId: string): Promise<RowStatus> => {
      setRow(idx, 'loading');
      try {
        await createIdea({ nicheId, body: buildBody(row, nicheId) }).unwrap();
        setRow(idx, 'added');
        return 'added';
      } catch (err) {
        const status =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status?: number }).status
            : undefined;
        // Backend currently has no unique-constraint on (niche, slogan_text);
        // 409 is unlikely. Treat 400 with `unique` in detail as duplicate.
        const detail = JSON.stringify(err ?? {}).toLowerCase();
        if (status === 409 || detail.includes('unique') || detail.includes('duplicate')) {
          setRow(idx, 'duplicate');
          return 'duplicate';
        }
        setRow(idx, 'error');
        return 'error';
      }
    },
    [createIdea, setRow],
  );

  const addMany = useCallback(
    async (
      indexes: ReadonlyArray<number>,
      rows: ReadonlyArray<SloganRow>,
      nicheId: string,
    ): Promise<void> => {
      for (const idx of indexes) {
        const row = rows[idx];
        if (!row) continue;
        // Skip already-added rows so re-clicking "Add all" is idempotent.
        if (statusByIndex[idx] === 'added' || statusByIndex[idx] === 'loading') {
          continue;
        }
        await addRow(idx, row, nicheId);
      }
    },
    [addRow, statusByIndex],
  );

  const reset = useCallback(() => setStatusByIndex({}), []);

  return { statusByIndex, addRow, addMany, reset };
};
