export type ResearchRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export type Marketplace =
  | 'amazon_com'
  | 'amazon_de'
  | 'amazon_co_uk'
  | 'amazon_fr'
  | 'amazon_it'
  | 'amazon_es';

export type ProductType =
  | 't_shirt'
  | 'hoodie'
  | 'long_sleeve'
  | 'sweatshirt'
  | 'popsocket'
  | 'tank_top';

export const MARKETPLACES: Marketplace[] = [
  'amazon_com',
  'amazon_de',
  'amazon_co_uk',
  'amazon_fr',
  'amazon_it',
  'amazon_es',
];

export const PRODUCT_TYPES: ProductType[] = [
  't_shirt',
  'hoodie',
  'long_sleeve',
  'sweatshirt',
  'popsocket',
  'tank_top',
];

export const RESEARCH_NODE_NAMES = [
  'scrape',
  'vision_analyze',
  'emotional_analyze',
  'niche_profile',
  'keywords',
  'finalize',
] as const;

export type ResearchNodeName = (typeof RESEARCH_NODE_NAMES)[number];

export interface ResearchProgress {
  completed_nodes: string[];
  current_node: string;
  status: ResearchRunStatus;
  total_nodes: number;
}

export interface ResearchTriggerParams {
  marketplace?: Marketplace;
  product_type?: ProductType;
  force_refresh?: boolean;
}

export type SentimentType = 'Positive' | 'Neutral' | 'Negative';

export const EMOTIONAL_PATTERNS = [
  'IDENTITY_DECLARATION',
  'GROUP_LEADER',
  'TRIBE_COMMUNITY',
  'FUNNY_ACTIVITY',
  'CROSS_NICHE_EVENTS',
  'CROSS_NICHE_MASHUP',
  'ADDICTION_OBSESSION',
  'VINTAGE_LEGACY',
  'ACHIEVEMENT_GAMIFIED',
  'JOB_PROFESSION_PARODY',
  'RELATIONSHIP_HUMOR',
  'BOUNDARY_GATEKEEPING',
  'ENDURANCE_SURVIVAL',
  'COMPETENCE_EXPERTISE',
  'CHAOS_CONTROL',
  'SELF_CARE_PRIORITIES',
] as const;

export type EmotionalPattern = (typeof EMOTIONAL_PATTERNS)[number];

export interface PatternItem {
  name: EmotionalPattern;
  present: boolean;
  context: string;
}

export interface CustomerPsychology {
  buyer_profile: string;
  emotional_need: string;
  internal_monologue: string;
  what_they_cant_say_out_loud: string;
}

export interface SentimentAnalysis {
  sentiment: string;
  primary_emotion: string;
  emotion_target: string;
  confrontation_level: string;
  workplace_culture_required: string;
  humor_style: string;
  humor_function: string;
}

export interface Vibe {
  energy_level: string;
  attitude: string;
  core_emotion: string;
}

export interface SemanticStructure {
  structural_template: string;
  wordplay_type: string;
  delivery_style: string;
}

export interface TransferabilityNotes {
  works_best_in: string[];
  avoid_in: string[];
  critical_success_factors: string[];
}

export interface VisionAnalysis {
  slogan_text: string;
  meaning_context: string;
  visual_style: string;
  graphic_elements: string;
  layout_composition: string;
}

export interface EmotionalAnalysis {
  customer_psychology: CustomerPsychology;
  sentiment_analysis: SentimentAnalysis;
  emotional_pattern: string;
  vibe: Vibe;
  semantic_structure: SemanticStructure;
  key_elements: string[];
  tone: string;
  adaptation_formula: string;
  adaptation_examples: string[];
  transferability_notes: TransferabilityNotes;
}

export interface ResearchProduct {
  asin: string;
  title: string;
  brand: string;
  url: string;
  rating: number;
  reviews_count: number;
  thumbnail_url: string;
  vision_analysis: VisionAnalysis | null;
  emotional_analysis: EmotionalAnalysis | null;
}

export interface NicheAnalysis {
  niche_summary: string;
  sentiment: SentimentType;
  primary_emotions: string[];
  emotional_archetype: string[];
  example_keywords: string[];
  pattern_analysis: PatternItem[];
  emotional_reality: string;
  design_concepts: string;
  dominant_design_aesthetics: string;
}

export interface NicheKeywords {
  main_short_tail: string[];
  main_long_tail: string[];
  all_keywords_flat: string;
  top_focus_keywords: string[];
  top_long_tail_keywords: string[];
}

export interface RelatedNiche {
  id: string;
  name: string;
  shared_patterns: string[];
}

export interface NicheResearchRun {
  id: string;
  status: ResearchRunStatus;
  created_at: string;
  completed_at: string | null;
  error_message?: string;
  completed_nodes: string[];
  current_node: string;
  total_nodes: number;
  marketplace: Marketplace;
  product_type: ProductType;
  retry_count: number;
  analysis: NicheAnalysis | null;
  keywords: NicheKeywords | null;
  products: ResearchProduct[];
  related_niches: RelatedNiche[];
}

export interface NicheResearchListItem {
  id: string;
  status: ResearchRunStatus;
  created_at: string;
  completed_at: string | null;
  error_message?: string;
}
