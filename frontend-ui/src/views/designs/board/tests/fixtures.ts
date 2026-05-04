import type {
  ArtboardData,
  BackgroundColor,
  Design,
  DesignGenerationRun,
  DesignModel,
  ReferenceProduct,
  BoardContext,
} from '../types';
import type { DesignProjectListItem, DesignProject } from '../../gallery/types';

// -- Board types --

export const makeReferenceProduct = (
  overrides?: Partial<ReferenceProduct>,
): ReferenceProduct => ({
  product_id: 'prod-1',
  image: 'https://example.com/product.jpg',
  title: 'Funny Dog Shirt',
  visual_style: 'cartoon',
  graphic_elements: 'dog illustration',
  layout_composition: 'centered',
  vibe: 'playful',
  emotional_pattern: 'joy',
  semantic_structure: {},
  key_elements: ['dog', 'humor'],
  tone: 'lighthearted',
  adaptation_formula: 'swap animal',
  adaptation_examples: ['cat version'],
  customer_psychology: {},
  sentiment_analysis: {},
  ...overrides,
});

export const makeDesignRun = (
  overrides?: Partial<DesignGenerationRun>,
): DesignGenerationRun => ({
  id: 'run-1',
  idea: 'idea-1',
  model_name: 'google/gemini-3.1-flash-preview-image-generation',
  status: 'completed',
  triggered_by: 1,
  prompt_used: 'A funny dog on a t-shirt',
  created_at: '2026-03-30T10:00:00Z',
  completed_at: '2026-03-30T10:01:00Z',
  error_message: '',
  ...overrides,
});

export const makeDesign = (overrides?: Partial<Design>): Design => ({
  id: 'design-1',
  workspace: 'ws-1',
  idea: 'idea-1',
  idea_summary: { id: 'idea-1', slogan_text: 'Life is better with a dog' },
  generation_run: makeDesignRun(),
  image_file: 'https://example.com/design.png',
  status: 'pending',
  is_manual: false,
  background_color: 'light_gray',
  source_image_url: '',
  prompt_analysis: {},
  upscaled_file: '',
  bg_removed_file: '',
  created_at: '2026-03-30T10:01:00Z',
  ...overrides,
});

export const makeBoardContext = (
  overrides?: Partial<BoardContext>,
): BoardContext => ({
  idea_id: 'idea-1',
  slogan_text: 'Life is better with a dog',
  niche_name: 'Funny Dogs',
  reference_products: [makeReferenceProduct()],
  designs: [makeDesign()],
  ...overrides,
});

export const makeArtboard = (
  overrides?: Partial<ArtboardData>,
): ArtboardData => ({
  id: 'ab-1',
  label: 'Artboard 1',
  x: 100,
  y: 100,
  width: 280,
  height: 280,
  imageUrl: null,
  kind: 'regular',
  sourceId: null,
  designId: null,
  opacity: 100,
  backgroundColor: '#FFFFFF',
  clipContent: true,
  ...overrides,
});

export const makeAiArtboard = (
  overrides?: Partial<ArtboardData>,
): ArtboardData =>
  makeArtboard({
    id: 'ab-ai-1',
    label: 'AI: Design',
    kind: 'ai',
    isGenerating: false,
    promptUsed: 'A funny dog on a t-shirt',
    modelUsed: 'google/gemini-3.1-flash-preview-image-generation' as DesignModel,
    bgColorUsed: 'light_gray' as BackgroundColor,
    ...overrides,
  });

// -- Gallery types --

export const makeProjectListItem = (
  overrides?: Partial<DesignProjectListItem>,
): DesignProjectListItem => ({
  id: 'proj-1',
  name: 'Summer Dogs',
  niche: 'niche-1',
  niche_name: 'Funny Dogs',
  design_count: 5,
  thumbnail: 'https://example.com/thumb.png',
  updated_at: '2026-03-30T10:00:00Z',
  created_at: '2026-03-29T10:00:00Z',
  ...overrides,
});

export const makeProject = (
  overrides?: Partial<DesignProject>,
): DesignProject => ({
  id: 'proj-1',
  name: 'Summer Dogs',
  niche: 'niche-1',
  niche_summary: { id: 'niche-1', name: 'Funny Dogs' },
  design_count: 5,
  thumbnail: 'https://example.com/thumb.png',
  board_layout: null,
  created_by: 1,
  created_at: '2026-03-29T10:00:00Z',
  updated_at: '2026-03-30T10:00:00Z',
  ...overrides,
});
