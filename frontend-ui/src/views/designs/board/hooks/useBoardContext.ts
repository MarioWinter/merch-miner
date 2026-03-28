import { useMemo } from 'react';
import { useGetBoardContextQuery } from '../../../../store/designSlice';
import type { Design } from '../types';

export const useBoardContext = (ideaId: string) => {
  const { data, isLoading, isError, error, refetch } =
    useGetBoardContextQuery(ideaId, { skip: !ideaId });

  const approvedDesign = useMemo(
    () => data?.designs.find((d: Design) => d.status === 'approved') ?? null,
    [data?.designs],
  );

  const pendingDesigns = useMemo(
    () => data?.designs.filter((d: Design) => d.status === 'pending') ?? [],
    [data?.designs],
  );

  return {
    board: data ?? null,
    sloganText: data?.slogan_text ?? '',
    nicheName: data?.niche_name ?? '',
    referenceProducts: data?.reference_products ?? [],
    designs: data?.designs ?? [],
    approvedDesign,
    pendingDesigns,
    isLoading,
    isError,
    error,
    refetch,
  };
};
