import { useMemo } from 'react';
import { useGetProjectBoardQuery } from '../../../../store/designSlice';
import type { Design } from '../types';

/**
 * Fetches project board context. Optionally overlays idea context
 * (slogan + reference products) when ideaId is provided.
 */
export const useBoardContext = (projectId: string, ideaId?: string) => {
  const { data, isLoading, isError, error, refetch } =
    useGetProjectBoardQuery(
      { projectId, ideaId },
      { skip: !projectId },
    );

  const designs = useMemo(
    () => data?.designs ?? [],
    [data?.designs],
  );

  const approvedDesign = useMemo(
    () => designs.find((d: Design) => d.status === 'approved') ?? null,
    [designs],
  );

  const pendingDesigns = useMemo(
    () => designs.filter((d: Design) => d.status === 'pending') ?? [],
    [designs],
  );

  return {
    project: data?.project ?? null,
    sloganText: data?.idea_context?.slogan_text ?? '',
    nicheName: data?.idea_context?.niche_name ?? '',
    referenceProducts: data?.idea_context?.reference_products ?? [],
    designs,
    boardLayout: data?.board_layout ?? null,
    approvedDesign,
    pendingDesigns,
    isLoading,
    isError,
    error,
    refetch,
  };
};
