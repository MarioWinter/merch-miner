// ---------------------------------------------------------------------------
// PROJ-11 Publish — shared TypeScript types
// ---------------------------------------------------------------------------

// ---- Enums / Unions -------------------------------------------------------

export type ListingStatus = 'draft' | 'ready' | 'published';
export type GeneratedBy = 'ai' | 'manual';
export type Availability = 'public' | 'private';
export type PublishMode = 'live' | 'draft';
export type PrintSide = 'front' | 'back' | 'both';
export type DesignSource = 'upload' | 'google_drive' | 'onedrive' | 'generated';
export type UploadJobStatus =
  | 'pending'
  | 'validating'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ListingLanguage = 'en' | 'de' | 'fr' | 'it' | 'es' | 'ja';

// ---- Models ---------------------------------------------------------------

export interface ListingTranslation {
  title: string;
  bullet_1: string;
  bullet_2: string;
  bullet_3: string;
  bullet_4: string;
  bullet_5: string;
  description: string;
  backend_keywords: string;
}

export interface Listing {
  id: string;
  idea: string;
  idea_text?: string;
  design: string | null;
  round: number;
  brand_name: string;
  title: string;
  bullet_1: string;
  bullet_2: string;
  bullet_3: string;
  bullet_4: string;
  bullet_5: string;
  description: string;
  backend_keywords: string;
  status: ListingStatus;
  generated_by: GeneratedBy;
  availability: Availability;
  publish_mode: PublishMode;
  language: ListingLanguage;
  translations: Record<string, ListingTranslation>;
  created_at: string;
  updated_at: string;
}

export interface UploadTemplate {
  id: string;
  workspace: string;
  name: string;
  brand_name: string;
  product_types: string[];
  fit_types: string[];
  colors: string[];
  marketplaces: MarketplaceConfig[];
  print_side: PrintSide;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceConfig {
  marketplace: string;
  price: string;
  enabled: boolean;
}

export interface UploadJob {
  id: string;
  workspace: string;
  listing: string;
  design: string;
  template: string | null;
  listing_snapshot: Record<string, unknown>;
  marketplace: string;
  status: UploadJobStatus;
  asin: string;
  upload_date: string | null;
  error_message: string;
  error_screenshot: string;
  retry_count: number;
  queued_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
}

export interface DesignAsset {
  id: string;
  workspace: string;
  file_name: string;
  file_url: string;
  source: DesignSource;
  source_file_id: string;
  thumbnail_url: string;
  dimensions: { width: number; height: number } | null;
  file_size: number;
  tags: string[];
  listing: string | null;
  idea: string | null;
  niche: string | null;
  round: number;
  created_by: string;
  created_at: string;
}

export interface LifecycleEntry {
  id: string;
  niche: string;
  niche_name?: string;
  idea: string | null;
  idea_text?: string;
  design: string | null;
  design_thumbnail?: string;
  listing: string | null;
  listing_title?: string;
  upload_job: string | null;
  asin: string;
  marketplace: string;
  upload_date: string | null;
  sales_units: number | null;
  sales_revenue: string | null;
  current_bsr: number | null;
  reviews_count: number | null;
  reviews_rating: string | null;
  round: number;
  updated_at: string;
}

// ---- API request/response types -------------------------------------------

export interface GenerateListingBody {
  design_id?: string;
  extra_keywords?: string;
  language?: ListingLanguage;
}

export interface TranslateListingBody {
  target_languages: ListingLanguage[];
}

export interface TMCheckResult {
  flagged_terms: { term: string; field: string; position: number }[];
  is_clean: boolean;
}

export interface GalleryListParams {
  page?: number;
  page_size?: number;
  tags?: string;
  has_listing?: boolean;
  sort_by?: 'newest' | 'recently_edited';
  search?: string;
}

export interface GalleryListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DesignAsset[];
}

export interface ImportDriveBody {
  file_ids: string[];
  provider: 'google_drive' | 'onedrive';
}

export interface BulkActionBody {
  ids: string[];
  action: 'apply_template' | 'apply_listing' | 'delete';
  source_id?: string;
}

export interface CreateUploadJobBody {
  listing_id: string;
  design_id: string;
  template_id?: string;
  marketplace: string;
}

export interface BatchUploadJobBody {
  design_ids: string[];
  template_id: string;
}

export interface UploadJobListParams {
  page?: number;
  page_size?: number;
  status?: UploadJobStatus;
}

export interface UploadJobListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: UploadJob[];
}

export interface LifecycleResponse {
  rounds: Record<number, LifecycleEntry[]>;
}

export interface UploadTemplateCreateBody {
  name: string;
  brand_name: string;
  product_types: string[];
  fit_types: string[];
  colors: string[];
  marketplaces: MarketplaceConfig[];
  print_side: PrintSide;
}

// ---- UI local types -------------------------------------------------------

export interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: () => void;
}

export const LISTING_CHAR_LIMITS = {
  brand_name: 50,
  title: 60,
  bullet_1: 256,
  bullet_2: 256,
  bullet_3: 256,
  bullet_4: 256,
  bullet_5: 256,
  description: 2000,
  backend_keywords: 500,
} as const;

export const SUPPORTED_LANGUAGES: { code: ListingLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Francais' },
  { code: 'it', label: 'Italiano' },
  { code: 'es', label: 'Espanol' },
  { code: 'ja', label: 'Japanese' },
];

export const MBA_MARKETPLACES = [
  { code: 'amazon_com', label: 'Amazon.com (US)', currency: 'USD' },
  { code: 'amazon_co_uk', label: 'Amazon.co.uk (UK)', currency: 'GBP' },
  { code: 'amazon_de', label: 'Amazon.de (DE)', currency: 'EUR' },
  { code: 'amazon_fr', label: 'Amazon.fr (FR)', currency: 'EUR' },
  { code: 'amazon_it', label: 'Amazon.it (IT)', currency: 'EUR' },
  { code: 'amazon_es', label: 'Amazon.es (ES)', currency: 'EUR' },
  { code: 'amazon_co_jp', label: 'Amazon.co.jp (JP)', currency: 'JPY' },
] as const;

export const MBA_PRODUCT_TYPES = [
  { key: 'standard_tshirt', label: 'Standard T-Shirt' },
  { key: 'premium_tshirt', label: 'Premium T-Shirt' },
  { key: 'vneck', label: 'V-Neck' },
  { key: 'tank_top', label: 'Tank Top' },
  { key: 'long_sleeve', label: 'Long Sleeve' },
  { key: 'hoodie', label: 'Hoodie' },
  { key: 'sweatshirt', label: 'Sweatshirt' },
  { key: 'popsocket', label: 'PopSocket' },
  { key: 'phone_case', label: 'Phone Case' },
  { key: 'tote_bag', label: 'Tote Bag' },
] as const;

export const MBA_FIT_TYPES = [
  'Men',
  'Women',
  'Youth',
  'Girls',
  'Adult Unisex',
] as const;
