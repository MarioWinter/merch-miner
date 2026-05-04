import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useGetNicheQuery } from '@/store/nicheSlice';
import { useListDesignsQuery, useListRoundsQuery } from '@/store/kanbanSlice';

export const useCardModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const cardId = searchParams.get('card');

  const isOpen = Boolean(cardId);

  const { data: niche, isLoading: nicheLoading } = useGetNicheQuery(cardId!, {
    skip: !cardId,
  });

  const currentRound = (niche as typeof niche & { current_round?: number })?.current_round ?? 1;

  const { data: designsData, isLoading: designsLoading } = useListDesignsQuery(
    { nicheId: cardId!, round: currentRound },
    { skip: !cardId },
  );

  const { data: rounds, isLoading: roundsLoading } = useListRoundsQuery(
    cardId!,
    { skip: !cardId },
  );

  const openCard = useCallback(
    (nicheId: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('card', nicheId);
        return next;
      });
    },
    [setSearchParams],
  );

  const closeCard = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('card');
      return next;
    });
  }, [setSearchParams]);

  return {
    isOpen,
    cardId,
    niche,
    currentRound,
    designs: designsData?.results ?? [],
    rounds: rounds ?? [],
    isLoading: nicheLoading || designsLoading || roundsLoading,
    openCard,
    closeCard,
  };
};
