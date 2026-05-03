// ---------------------------------------------------------------------------
// PROJ-11 Publish — shared TypeScript types
// ---------------------------------------------------------------------------

// ---- Enums / Unions -------------------------------------------------------

export type ListingStatus = 'draft' | 'ready' | 'published';
export type GeneratedBy = 'ai' | 'manual';
export type Availability = 'public' | 'private';
export type PublishMode = 'live' | 'draft';
export type PrintSide = 'front' | 'back' | 'both';
export type MarketplaceType = 'global' | 'mba' | 'displate';
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
  description: string;
}

// Phase R (2026-04-24): per-language keyword chips for Global/Displate.
// Shape: { lang: [keyword, ...] } where lang ∈ {en, de, fr, it, es, ja}.
export type ListingKeywords = Partial<Record<ListingLanguage, string[]>>;

// Phase U (2026-04-24): fit-type flags used by the Basic export Type column.
export type ListingTypeFlag = 'men' | 'women' | 'youth';

// Phase U (2026-04-24): design color mode used by the Basic export Color column.
export type ListingColorMode = '' | 'black' | 'white' | 'colorful';

export interface Listing {
  id: string;
  idea: string;
  idea_text?: string;
  design: string | null;
  marketplace_type: MarketplaceType;
  round: number;
  brand_name: string;
  title: string;
  bullet_1: string;
  bullet_2: string;
  description: string;
  // Phase I rename (2026-04-23): `backend_keywords` → `keyword_context`.
  keyword_context: string;
  // Phase R/U (2026-04-24): Global + Displate marketplace-scoped fields.
  // Each is `null` (or empty) when not applicable for the marketplace.
  keywords?: ListingKeywords;
  type_flags?: ListingTypeFlag[];
  color_mode?: ListingColorMode;
  background_color_hex?: string;
  category?: string;
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
  collection: string | null;
  round: number;
  created_by: string;
  created_at: string;
}

// ---- Collection types -----------------------------------------------------

export interface DesignCollection {
  id: string;
  name: string;
  parent: string | null;
  position: number;
  child_count: number;
  asset_count: number;
  created_by: string;
  created_at: string;
}

export interface CollectionDetail {
  collection: DesignCollection;
  children: DesignCollection[];
  assets: DesignAsset[];
  assets_count: number;
  assets_next: string | null;
  assets_previous: string | null;
}

export interface CollectionTreeNode {
  id: string;
  name: string;
  children: CollectionTreeNode[];
  asset_count: number;
}

export interface CreateCollectionBody {
  name: string;
  parent?: string | null;
}

export interface UpdateCollectionBody {
  name?: string;
  parent?: string | null;
}

export interface MoveAssetsBody {
  asset_ids: string[];
  collection_id: string | null;
}

export interface ListCollectionsParams {
  parent?: string;
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
  marketplace_type?: MarketplaceType;
}

export interface GetListingParams {
  ideaId: string;
  marketplace_type?: MarketplaceType;
}

export interface ConvertListingBody {
  source_listing_id: string;
  target_marketplace_type: MarketplaceType;
  overwrite?: boolean;
}

export interface ConvertListingResponse extends Listing {
  product_config_seeded?: boolean;
}

export interface TranslateListingBody {
  target_languages: ListingLanguage[];
}

export interface GalleryListParams {
  page?: number;
  page_size?: number;
  tags?: string;
  has_listing?: boolean;
  sort_by?: 'newest' | 'recently_edited';
  search?: string;
  collection?: string;
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
  template_id?: string;
  /** Target marketplace string (e.g. "amazon.com"). Required by the backend
   *  UploadJobBatchSerializer — one marketplace per batch. Multi-marketplace
   *  fan-out happens by queuing the batch multiple times (one per target). */
  marketplace: string;
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
  brand_name?: string;
  // Phase K2 (2026-04-23): per-product config replaces the legacy flat
  // product_types/fit_types/colors/marketplaces/print_side fields.
  products_config?: ProductConfigEntry[];
  marketplace_type?: MarketplaceType;
  is_default?: boolean;
}

// ---- UI local types -------------------------------------------------------

export type FileSystemTab = 'my_designs' | 'cloud_storage';
export type ViewMode = 'grid' | 'list';

export interface BreadcrumbSegment {
  id: string | null;
  label: string;
}

export interface SelectionState {
  selectedIds: Set<string>;
  lastClickedId: string | null;
  anchorId: string | null;
}

export interface CommandAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: string;
  action: () => void;
  disabled?: boolean;
}

export const LISTING_CHAR_LIMITS = {
  brand_name: 50,
  title: 60,
  bullet_1: 256,
  bullet_2: 256,
  description: 2000,
  keyword_context: 500,
  // Phase U (AC-85): total keyword length per language = `keywords[lang].join(', ').length`.
  keywords_per_language: 50,
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

// ---- MBA Colors (from backend) -------------------------------------------

export interface MbaColor {
  key: string;
  name: string;
  hex: string;
}

// ---- Design Product Config (F4) -----------------------------------------

// Per-product entry stored in `DesignProductConfig.products_config` (AC-38 J2).
// One entry per MBA product catalog key.
export interface ProductConfigMarketplaceEntry {
  marketplace: string;
  price: number;
  enabled: boolean;
}

export interface ProductConfigEntry {
  product_type: string;
  enabled: boolean;
  fit_types: string[];
  print_side: PrintSide;
  colors: string[];
  marketplaces: ProductConfigMarketplaceEntry[];
}

export interface DesignProductConfig {
  id: string;
  design: string;
  marketplace_type: MarketplaceType;
  products_config: ProductConfigEntry[];
  created_at: string;
  updated_at: string;
}

export interface GetProductConfigParams {
  designId: string;
  marketplace_type: MarketplaceType;
}

// PATCH body — backend accepts either a full-replace `products_config`
// array (AC-38) or a targeted `op=upsert_product` payload (AC-40). The two
// shapes are mutually exclusive; the serializer rejects bodies that mix
// both forms.
export interface UpdateProductConfigBody {
  marketplace_type: MarketplaceType;
  // ---- Full-replace form (AC-38) ----
  products_config?: ProductConfigEntry[];
  // ---- Targeted upsert form (AC-40) ----
  op?: 'upsert_product';
  product_type?: string;
  patch?: Partial<Omit<ProductConfigEntry, 'product_type'>>;
}

// Copy-from scope enum aligned with backend ``COPY_SCOPE_CHOICES`` (AC-41 Phase L3):
// ``'all'`` wholesale or a single entry field.
export type ProductConfigCopyScope =
  | 'all'
  | 'colors'
  | 'enabled'
  | 'fit_types'
  | 'print_side'
  | 'marketplaces';

export interface CopyProductConfigFromBody {
  designId: string;
  source_design_id: string;
  marketplace_type: MarketplaceType;
  scope: ProductConfigCopyScope;
  // Optional — scopes a scalar copy to a single product entry (AC-41).
  product_type?: string;
}

// ---- MBA Product Catalog (AC-37, Phase L) --------------------------------

export interface MbaProductCatalogRoyalty {
  coef: number;
  base: number;
}

export interface MbaProductCatalogEntry {
  key: string;
  label: string;
  icon_key: string;
  supports: string[];
  fit_types_options: string[];
  print_side_options: PrintSide[];
  colors_options: MbaColor[];
  marketplaces: string[];
  default_prices: Record<string, number>;
  royalty_formula: Record<string, MbaProductCatalogRoyalty>;
}

// ---- AI Improve (AC-69..AC-72, Phase M) ---------------------------------

export interface AIImproveListingResponse {
  listing: Listing;
  truncated_fields: string[];
}

// ---- FlyingUpload Export (Phase U1, 2026-04-24) --------------------------

export type FlyingUploadTemplate = 'mba' | 'basic';
export type FlyingUploadFormat = 'xlsx' | 'csv';

export interface FlyingUploadExportBody {
  template: FlyingUploadTemplate;
  format: FlyingUploadFormat;
  design_ids?: string[];
  collection_id?: string;
}

export interface FlyingUploadPreviewSkipped {
  design_id: string;
  reason: string;
}

export interface FlyingUploadPreviewWarning {
  code: string;
  detail?: unknown;
}

export interface FlyingUploadPreviewResponse {
  total_designs: number;
  ready_rows: number;
  skipped: FlyingUploadPreviewSkipped[];
  warnings: FlyingUploadPreviewWarning[];
}

export interface FlyingUploadExportResult {
  blob: Blob;
  filename: string;
}

export interface ExportLogAuthor {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string;
}

export interface ExportLog {
  id: string;
  template: FlyingUploadTemplate;
  format: FlyingUploadFormat;
  design_count: number;
  row_count: number;
  // Denormalized list of UUIDs at export time (AC-114). Used by the History
  // drawer hover tooltip and the Re-run flow (AC-140).
  design_ids: string[];
  filename: string;
  output_size_bytes: number;
  created_at: string;
  created_by: ExportLogAuthor;
}

export interface ExportHistoryParams {
  page?: number;
  page_size?: number;
}

export interface ExportHistoryResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ExportLog[];
}

// ---- Send-to-Listings (PROJ-9 Phase O) ------------------------------------

export interface DesignAssetFromDesignBody {
  design_ids: string[];
}

export interface DesignAssetFromDesignRejected {
  id: string;
  reason: 'not_approved' | 'no_image' | string;
}

export interface DesignAssetFromDesignFailed {
  id: string;
  error: string;
}

/**
 * Response from POST /api/design-assets/from-design/.
 * 200 = full success. 207 = partial success (`failed` non-empty).
 */
export interface DesignAssetFromDesignResponse {
  created: string[];
  skipped_duplicates: string[];
  rejected_ineligible: DesignAssetFromDesignRejected[];
  failed?: DesignAssetFromDesignFailed[];
}
