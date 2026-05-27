import { useMemo } from 'react';
import { useGetCollectedProductsQuery } from '@/store/collectedProductsSlice';

/**
 * Derives "is this product already in the active niche's CollectedProduct
 * set" from the RTK Query cache.
 *
 * Match condition (mirrors backend uniqueness): same niche + same ASIN +
 * same marketplace. We rely on `useGetCollectedProductsQuery` as the
 * single source of truth (no parallel "liked" slice — see
 * `feedback_rtk_single_source.md`).
 */
export interface UseIsProductLikedResult {
  isLiked: boolean;
  collectedProductId: string | null;
  isLoading: boolean;
}

export const useIsProductLiked = (
  nicheId: string | null,
  asin: string,
  marketplace: string,
): UseIsProductLikedResult => {
  // RTK Query: skip when there is no niche to query against.
  const { data, isLoading } = useGetCollectedProductsQuery(nicheId ?? '', {
    skip: !nicheId,
  });

  return useMemo(() => {
    if (!nicheId || !asin || !marketplace) {
      return { isLiked: false, collectedProductId: null, isLoading: false };
    }

    const match = data?.results?.find(
      (item) =>
        item.product.asin === asin && item.product.marketplace === marketplace,
    );

    return {
      isLiked: Boolean(match),
      collectedProductId: match?.id ?? null,
      isLoading,
    };
  }, [data, nicheId, asin, marketplace, isLoading]);
};
