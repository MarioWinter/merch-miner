import type { PipelineCardState } from '@/components/PipelineCard';
import type { Niche } from '../types/index';

export interface PipelineStates {
  research: PipelineCardState;
  keywords: PipelineCardState;
  products: PipelineCardState;
  slogans: PipelineCardState;
  designs: PipelineCardState;
  listings: PipelineCardState;
  upload: PipelineCardState;
}

/**
 * Compute pipeline card states from niche data + counts.
 * Rules: active = currently in progress, done = has data, pending = nothing yet.
 */
export const usePipelineStates = (
  niche: Niche | undefined,
  counts: {
    keywordCount: number;
    productCount: number;
    sloganCount: number;
    designProjectCount: number;
  },
): PipelineStates => {
  if (!niche) {
    return {
      research: 'pending',
      keywords: 'pending',
      products: 'pending',
      slogans: 'pending',
      designs: 'pending',
      listings: 'pending',
      upload: 'pending',
    };
  }

  const researchStatus = niche.research_progress?.status ?? null;
  const isResearchRunning = researchStatus === 'pending' || researchStatus === 'running';
  const isResearchDone = researchStatus === 'completed';

  const research: PipelineCardState = isResearchRunning
    ? 'active'
    : isResearchDone
      ? 'done'
      : 'pending';

  const keywords: PipelineCardState = counts.keywordCount > 0 ? 'done' : 'pending';
  const products: PipelineCardState = counts.productCount > 0 ? 'done' : 'pending';
  const slogans: PipelineCardState = counts.sloganCount > 0 ? 'done' : 'pending';
  const designs: PipelineCardState = counts.designProjectCount > 0 ? 'done' : 'pending';

  // Listings + Upload are placeholders — always pending until PROJ-11
  const listings: PipelineCardState = 'pending';
  const upload: PipelineCardState = 'pending';

  return { research, keywords, products, slogans, designs, listings, upload };
};
