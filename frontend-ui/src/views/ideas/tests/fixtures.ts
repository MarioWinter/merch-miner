import type { Idea, IdeaAdaptationRun, NicheSuggestion } from '../types';

export const makeIdea = (overrides?: Partial<Idea>): Idea => ({
  id: 'idea-1',
  workspace: 'ws-1',
  niche: 'niche-1',
  niche_name: 'Funny Dogs',
  adaptation_run: null,
  source_idea: null,
  source_idea_summary: null,
  source_product_url: '',
  slogan_text: 'Life is better with a dog',
  is_manual: false,
  signal_type: 'self',
  creative_modules_used: [],
  emotional_archetype: 'belonging',
  buyer_voice_pattern: '',
  stylistic_device: '',
  pattern_used: 'Metaphor',
  why_it_works: 'Appeals to pet lovers',
  market_confidence: 'High',
  status: 'pending',
  was_changed: false,
  change_reason: '',
  created_by: 1,
  created_at: '2026-03-29T10:00:00Z',
  ...overrides,
});

export const makeOrphanIdea = (overrides?: Partial<Idea>): Idea =>
  makeIdea({
    id: 'orphan-1',
    niche: null,
    niche_name: null,
    slogan_text: 'Orphan slogan',
    ...overrides,
  });

export const makeAdaptedIdea = (sourceId: string, overrides?: Partial<Idea>): Idea =>
  makeIdea({
    id: `adapted-${sourceId}-1`,
    source_idea: sourceId,
    slogan_text: 'Adapted slogan',
    signal_type: 'other',
    market_confidence: 'Medium',
    ...overrides,
  });

export const makeAdaptationRun = (
  overrides?: Partial<IdeaAdaptationRun>,
): IdeaAdaptationRun => ({
  id: 'run-1',
  workspace: 'ws-1',
  source_idea: 'idea-1',
  source_idea_text: 'Life is better with a dog',
  target_niche_ids: ['niche-2', 'niche-3'],
  niche_results: {},
  status: 'pending',
  triggered_by: 1,
  completed_nodes: [],
  current_node: '',
  created_at: '2026-03-29T10:00:00Z',
  completed_at: null,
  error_message: '',
  ...overrides,
});

export const makeSuggestion = (
  overrides?: Partial<NicheSuggestion>,
): NicheSuggestion => ({
  niche_id: 'niche-2',
  niche_name: 'Cat Lovers',
  compatibility_score: 85,
  shared_patterns: ['Metaphor', 'Alliteration'],
  already_adapted: false,
  has_completed_research: false,
  research_status: null,
  ...overrides,
});
