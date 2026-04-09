import type { PipelineCardState } from '@/components/PipelineCard';
import type { Niche } from '../types/index';
import type { ListingCounts } from '../partials/ListingsPipelineContent';
import type { UploadCounts } from '../partials/UploadPipelineContent';

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
    listingCounts?: ListingCounts;
    uploadCounts?: UploadCounts;
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

  // Listings: done when any listing exists, pending otherwise
  const listingTotal = counts.listingCounts
    ? counts.listingCounts.draft + counts.listingCounts.ready + counts.listingCounts.published
    : 0;
  const listings: PipelineCardState = listingTotal > 0 ? 'done' : 'pending';

  // Upload: active when pending uploads, done when all completed, pending otherwise
  const uploadTotal = counts.uploadCounts
    ? counts.uploadCounts.pending + counts.uploadCounts.completed + counts.uploadCounts.failed
    : 0;
  const upload: PipelineCardState = uploadTotal > 0
    ? (counts.uploadCounts!.pending > 0 ? 'active' : 'done')
    : 'pending';

  return { research, keywords, products, slogans, designs, listings, upload };
};
