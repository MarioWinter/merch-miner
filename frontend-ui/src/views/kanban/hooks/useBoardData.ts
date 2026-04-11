import { useMemo } from 'react';
import { useListNichesQuery } from '@/store/nicheSlice';
import type { Niche } from '../../niches/list/types';
import type { KanbanColumnId, NicheCard } from '../types';
import { COLUMN_DEFS, STATUS_TO_COLUMN } from '../types';

interface UseBoardDataOptions {
  assigneeFilter: number | null;
  showArchived: boolean;
}

interface ColumnData {
  id: KanbanColumnId;
  label: string;
  color: string;
  cards: NicheCard[];
}

const mapNicheToCard = (n: Niche): NicheCard => ({
  id: n.id,
  name: n.name,
  status: n.status,
  current_round: (n as Niche & { current_round?: number }).current_round ?? 1,
  assigned_to: n.assigned_to,
  idea_count: n.idea_count ?? 0,
  approved_idea_count: n.approved_idea_count ?? 0,
  created_at: n.created_at,
  updated_at: n.updated_at,
});

export const useBoardData = ({ assigneeFilter, showArchived }: UseBoardDataOptions) => {
  const { data, isLoading, isError, error, refetch } = useListNichesQuery({
    page_size: 200,
  });

  const niches = data?.results;
  const totalCount = data?.count ?? 0;

  const columns = useMemo<ColumnData[]>(() => {
    const filtered = (niches ?? []).filter((n) => {
      // Hide archived unless toggled
      if (n.status === 'archived' && !showArchived) return false;
      // Assignee filter
      if (assigneeFilter !== null && n.assigned_to !== assigneeFilter) return false;
      return true;
    });

    return COLUMN_DEFS.map((def) => ({
      id: def.id,
      label: def.label,
      color: def.color,
      cards: filtered
        .filter((n) => STATUS_TO_COLUMN[n.status] === def.id)
        .map(mapNicheToCard),
    }));
  }, [niches, assigneeFilter, showArchived]);

  return {
    columns,
    totalCount,
    isLoading,
    isError,
    error,
    refetch,
    showWarning: totalCount > 200,
  };
};
