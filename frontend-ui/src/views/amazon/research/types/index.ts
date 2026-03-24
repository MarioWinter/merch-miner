export interface AmazonProduct {
  asin: string;
  title: string;
  brand: string;
  bsr: number | null;
  rating: number | null;
  reviews_count: number | null;
  price: number | null;
  product_type: string;
  subcategory: string;
  listed_date: string | null;
  thumbnail_url: string;
  bullet_1: string;
  bullet_2: string;
  description: string;
  marketplace: string;
  scraped_at: string;
}

export type ProductSearchStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ResearchMode = 'live' | 'db';

export interface ResearchFilters {
  keyword: string;
  marketplace: string;
  bsr_min: number;
  bsr_max: number;
  rating_min: number;
  reviews_min: number;
  reviews_max: number;
  price_min: number;
  price_max: number;
  date_from: string;
  date_to: string;
  product_type: string;
  subcategory: string;
  hide_official_brands: boolean;
  exclude_words: string;
  sort_by: string;
}

export type FilterKey = keyof Omit<ResearchFilters, 'keyword' | 'marketplace' | 'sort_by'>;

export type FilterEnabled = Record<FilterKey, boolean>;

export interface SuggestionItem {
  value: string;
}

export interface SearchCacheStatus {
  cache_id: string;
  status: ProductSearchStatus;
  pages_done: number;
  products_scraped: number;
  error_log: string | null;
  products?: AmazonProduct[];
}

export interface BSRSnapshot {
  bsr: number;
  rating: number | null;
  price: number | null;
  recorded_at: string;
}

export interface ProductListResponse {
  count: number;
  results: AmazonProduct[];
  next: string | null;
  previous: string | null;
}

export interface LiveSearchParams {
  keyword: string;
  marketplace: string;
  product_type?: string;
  hide_official_brands?: boolean;
}

export interface LiveSearchResponse {
  cache_id: string;
  status: ProductSearchStatus;
}

export interface MarketplaceOption {
  value: string;
  label: string;
  flag: string;
  domain: string;
}

export const MARKETPLACE_OPTIONS: MarketplaceOption[] = [
  { value: 'amazon_com', label: 'Amazon.com', flag: '\u{1F1FA}\u{1F1F8}', domain: 'amazon.com' },
  { value: 'amazon_co_uk', label: 'Amazon.co.uk', flag: '\u{1F1EC}\u{1F1E7}', domain: 'amazon.co.uk' },
  { value: 'amazon_de', label: 'Amazon.de', flag: '\u{1F1E9}\u{1F1EA}', domain: 'amazon.de' },
  { value: 'amazon_fr', label: 'Amazon.fr', flag: '\u{1F1EB}\u{1F1F7}', domain: 'amazon.fr' },
  { value: 'amazon_it', label: 'Amazon.it', flag: '\u{1F1EE}\u{1F1F9}', domain: 'amazon.it' },
  { value: 'amazon_es', label: 'Amazon.es', flag: '\u{1F1EA}\u{1F1F8}', domain: 'amazon.es' },
];

export const PRODUCT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 't_shirt', label: 'T-Shirt' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'pullover', label: 'Pullover' },
  { value: 'zip_hoodie', label: 'Zip Hoodie' },
  { value: 'long_sleeve', label: 'Long Sleeve' },
  { value: 'tank_top', label: 'Tank Top' },
];

export const SORT_OPTIONS = [
  { value: 'bsr_asc', label: 'BSR (Low to High)' },
  { value: 'reviews_desc', label: 'Reviews (High to Low)' },
  { value: 'rating_desc', label: 'Rating (High to Low)' },
  { value: 'price_asc', label: 'Price (Low to High)' },
  { value: 'newest', label: 'Newest First' },
];

export const DEFAULT_FILTERS: ResearchFilters = {
  keyword: '',
  marketplace: 'amazon_com',
  bsr_min: 1,
  bsr_max: 500000,
  rating_min: 0,
  reviews_min: 0,
  reviews_max: 10000,
  price_min: 1,
  price_max: 100,
  date_from: '',
  date_to: '',
  product_type: '',
  subcategory: '',
  hide_official_brands: false,
  exclude_words: '',
  sort_by: 'bsr_asc',
};

export const DEFAULT_FILTER_ENABLED: FilterEnabled = {
  bsr_min: false,
  bsr_max: false,
  rating_min: false,
  reviews_min: false,
  reviews_max: false,
  price_min: false,
  price_max: false,
  date_from: false,
  date_to: false,
  product_type: false,
  subcategory: false,
  hide_official_brands: false,
  exclude_words: false,
};
