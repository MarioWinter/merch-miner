import { useGetCollectedProductsQuery } from '@/store/collectedProductsSlice';
import { useListIdeasQuery } from '@/store/ideaSlice';
import { useListNicheKeywordsQuery } from '@/store/keywordSlice';
import { useListProjectsQuery } from '@/store/designSlice';
import type { DesignProjectListItem } from '@/views/designs/gallery/types';

interface DrawerPipelineCounts {
  keywordCount: number;
  productCount: number;
  sloganCount: number;
  designProjectCount: number;
}

/**
 * Fetch all data needed to compute pipeline card badges and states.
 * Queries are skipped when nicheId is empty (create mode).
 */
export const useDrawerPipelineCounts = (nicheId: string): DrawerPipelineCounts => {
  const skip = !nicheId;

  const { data: collectedData } = useGetCollectedProductsQuery(nicheId, { skip });
  const { data: ideasData } = useListIdeasQuery(
    { nicheId, page_size: 100 },
    { skip },
  );
  const { data: keywordsData } = useListNicheKeywordsQuery(
    { nicheId, page_size: 500 },
    { skip },
  );
  const { data: projectData } = useListProjectsQuery(undefined, { skip });

  const productCount = collectedData?.results?.length ?? 0;
  const sloganCount = (ideasData?.results ?? []).filter(
    (i) => i.is_manual || i.status === 'approved',
  ).length;
  const keywordCount = keywordsData?.results?.length ?? 0;
  const designProjectCount = projectData?.results
    ? projectData.results.filter((p: DesignProjectListItem) => p.niche === nicheId).length
    : 0;

  return { keywordCount, productCount, sloganCount, designProjectCount };
};
