export type KeywordSource =
  | 'research'
  | 'amazon_search'
  | 'web_search'
  | 'manual'
  | 'junglescout';

export interface KeywordJSData {
  monthly_search_volume_exact: number | null;
  monthly_search_volume_broad: number | null;
  monthly_trend: number | null;
  quarterly_trend: number | null;
  ppc_bid_exact: number | null;
  ppc_bid_broad: number | null;
  sp_brand_ad_bid: number | null;
  ease_of_ranking_score: number | null;
  relevancy_score: number | null;
  organic_product_count: number | null;
  sponsored_product_count: number | null;
  dominant_category: string;
  recommended_promotions: number | null;
  fetched_at: string | null;
}

export interface KeywordSearchResult {
  keyword: string;
  source: KeywordSource;
  in_product_count: number;
  in_slogan_count: number;
  js_data: KeywordJSData | null;
}

export interface KeywordSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: KeywordSearchResult[];
}

export interface KeywordSearchParams {
  query: string;
  marketplace?: string;
  page?: number;
  page_size?: number;
}

export interface KeywordEnrichRequest {
  keywords: string[];
  marketplace?: string;
}

export interface KeywordEnrichResult {
  keyword: string;
  js_data: KeywordJSData;
  from_cache: boolean;
}

export interface KeywordHistoryPoint {
  month: string;
  search_volume: number;
}

export interface KeywordHistoryParams {
  keyword: string;
  marketplace?: string;
  start_date?: string;
  end_date?: string;
}

export interface NicheKeywordGroup {
  id: string;
  name: string;
  position: number;
  keyword_count: number;
}

export interface NicheKeyword {
  id: string;
  niche: string;
  keyword: string;
  source: KeywordSource;
  group: { id: string; name: string } | null;
  design_template: { id: string; slogan: string } | null;
  js_data: KeywordJSData | null;
  created_by: number | null;
  created_at: string;
}

export interface NicheKeywordListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: NicheKeyword[];
}

export interface NicheKeywordListParams {
  nicheId: string;
  source?: KeywordSource;
  group_id?: string;
  page?: number;
  page_size?: number;
}

export interface AddKeywordBody {
  keyword: string;
  source?: KeywordSource;
  group_id?: string;
}

export interface BulkAddKeywordsBody {
  keywords: { keyword: string; source?: KeywordSource }[];
  group_id?: string;
}

export interface UpdateKeywordBody {
  group_id?: string | null;
  position?: number;
  design_template_id?: string | null;
}

export interface CreateGroupBody {
  name: string;
}

export interface UpdateGroupBody {
  name?: string;
  position?: number;
}

/** Column visibility config for the keyword table */
export interface KeywordColumnVisibility {
  keyword: boolean;
  source: boolean;
  monthly_search_volume_exact: boolean;
  ppc_bid_exact: boolean;
  ease_of_ranking_score: boolean;
  organic_product_count: boolean;
  in_product_count: boolean;
  in_slogan_count: boolean;
  monthly_trend: boolean;
  quarterly_trend: boolean;
  monthly_search_volume_broad: boolean;
  ppc_bid_broad: boolean;
  sp_brand_ad_bid: boolean;
  relevancy_score: boolean;
  sponsored_product_count: boolean;
  dominant_category: boolean;
  recommended_promotions: boolean;
}

export const DEFAULT_COLUMN_VISIBILITY: KeywordColumnVisibility = {
  keyword: true,
  source: true,
  monthly_search_volume_exact: true,
  ppc_bid_exact: true,
  ease_of_ranking_score: true,
  organic_product_count: true,
  in_product_count: true,
  in_slogan_count: true,
  monthly_trend: false,
  quarterly_trend: false,
  monthly_search_volume_broad: false,
  ppc_bid_broad: false,
  sp_brand_ad_bid: false,
  relevancy_score: false,
  sponsored_product_count: false,
  dominant_category: false,
  recommended_promotions: false,
};
