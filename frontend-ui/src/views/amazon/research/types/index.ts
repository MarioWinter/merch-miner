import React from 'react';
import SearchIcon from '@mui/icons-material/Search';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import NewReleasesIcon from '@mui/icons-material/NewReleases';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ReviewsIcon from '@mui/icons-material/Reviews';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type { SvgIconProps } from '@mui/material/SvgIcon';

export interface AmazonProduct {
  asin: string;
  title: string;
  brand: string;
  bsr: number | null;
  bsr_categories: BSRCategory[];
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

export type ProductSearchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

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
  live_sort_by: string;
}

export type FilterKey = keyof Omit<
  ResearchFilters,
  'keyword' | 'marketplace' | 'sort_by' | 'live_sort_by'
>;

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
  sort_by?: string;
  price_min?: number | null;
  price_max?: number | null;
  browse_node?: string;
  pages_total?: number;
  start_page?: number;
}

export interface LiveSearchResponse {
  cache_id: string;
  status: ProductSearchStatus;
}

export interface MetaKeyword {
  id: number;
  keyword: string;
  type: 'short_tail' | 'long_tail';
  frequency: number;
}

export interface BSRCategory {
  rank: number;
  category: string;
  category_url?: string;
}

export interface ProductDetail extends AmazonProduct {
  meta_keywords: MetaKeyword[];
}

export interface BSRSummary {
  overall_trend: 'up' | 'down' | 'stable';
  current_trend: 'up' | 'down' | 'stable';
  average: number;
  median: number;
}

export interface BSRHistoryResponse {
  snapshots: BSRSnapshot[];
  summary: BSRSummary | null;
}

export interface PriceSnapshot {
  price: number;
  recorded_at: string;
}

export interface SimilarProduct {
  asin: string;
  title: string;
  brand: string;
  bsr: number | null;
  price: number | null;
  reviews_count: number | null;
  listed_date: string | null;
  thumbnail_url: string;
  marketplace: string;
}

export interface UseAsTemplateResponse {
  listing_id: number;
  message: string;
}

export interface SearchKeywordResult {
  top_focus_keywords: Array<{ keyword: string; frequency: number }>;
  top_long_tail_keywords: Array<{ keyword: string; frequency: number }>;
}

export interface SearchCacheStatusExtended extends SearchCacheStatus {
  keyword_result?: SearchKeywordResult | null;
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

export interface ProductTypeOption {
  value: string;
  label: string;
}

export const PRODUCT_TYPE_OPTIONS: ProductTypeOption[] = [
  { value: 't_shirt', label: 'T-Shirt' },
  { value: 'premium_shirt', label: 'Premium Shirt' },
  { value: 'comfort_colors', label: 'Comfort Colors' },
  { value: 'v_neck', label: 'V-Neck' },
  { value: 'long_sleeve', label: 'Long Sleeve' },
  { value: 'raglan', label: 'Raglan' },
  { value: 'sweatshirt', label: 'Sweatshirt' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'performance_polo', label: 'Performance Polo' },
  { value: 'zip_hoodie', label: 'Zip Hoodie' },
  { value: 'popsocket', label: 'PopSocket' },
  { value: 'phone_case', label: 'Phone Case' },
  { value: 'tote_bag', label: 'Tote Bag' },
  { value: 'tumbler', label: 'Tumbler' },
  { value: 'ceramic_mug', label: 'Ceramic Mug' },
  { value: 'tank_top', label: 'Tank Top' },
];

export interface SortOption {
  value: string;
  label: string;
  icon: React.ComponentType<SvgIconProps>;
}

export const SORT_OPTIONS: SortOption[] = [
  { value: 'bsr_asc', label: 'BSR (Low to High)', icon: FormatListNumberedIcon },
  { value: 'reviews_desc', label: 'Reviews (High to Low)', icon: ThumbUpIcon },
  { value: 'rating_desc', label: 'Rating (High to Low)', icon: StarIcon },
  { value: 'price_asc', label: 'Price (Low to High)', icon: AttachMoneyIcon },
  { value: 'newest', label: 'Newest First', icon: ScheduleIcon },
];

export const LIVE_SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Relevance', icon: SearchIcon },
  { value: 'exact-aware-popularity-rank', label: 'Best Sellers', icon: EmojiEventsIcon },
  { value: 'featured-rank', label: 'Featured', icon: StarIcon },
  { value: 'date-desc-rank', label: 'Newest', icon: NewReleasesIcon },
  { value: 'price-asc-rank', label: 'Price: Low to High', icon: TrendingDownIcon },
  { value: 'price-desc-rank', label: 'Price: High to Low', icon: TrendingUpIcon },
  { value: 'review-rank', label: 'Avg Reviews', icon: ReviewsIcon },
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
  product_type: 't_shirt',
  subcategory: '',
  hide_official_brands: false,
  exclude_words: '',
  sort_by: 'bsr_asc',
  live_sort_by: 'featured-rank',
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

/** Default browse nodes per product type (mirrors backend PRODUCT_TYPE_SPIDER_KWARGS) */
export const PRODUCT_TYPE_BROWSE_NODES: Record<string, string> = {
  t_shirt: '12035955011',
  premium_shirt: '12035955011',
  comfort_colors: '',
  v_neck: '',
  long_sleeve: '12035955011',
  raglan: '12035955011',
  sweatshirt: '12035955011',
  hoodie: '',
  performance_polo: '',
  zip_hoodie: '',
  popsocket: '',
  phone_case: '',
  tote_bag: '',
  tumbler: '',
  ceramic_mug: '',
  tank_top: '',
};
