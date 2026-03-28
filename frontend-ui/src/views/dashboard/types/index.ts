// PROJ-12: Dashboard & Analytics — TypeScript types

export interface NicheCounts {
  research: number;
  design: number;
  publish: number;
  live: number;
  done: number;
  archived: number;
}

export interface DesignCounts {
  total: number;
  approved: number;
}

export interface ListingCounts {
  total: number;
  ready: number;
}

export interface ActivityEvent {
  event: string;
  niche_name: string;
  user: string;
  agent_type: string | null;
  timestamp: string;
  target_id?: string;
}

export interface StuckNiche {
  id: string;
  name: string;
  status: string;
  days_stuck: number;
}

export interface LastCompleted {
  niche: string;
  template: string;
  duration_minutes: number;
}

export interface AgentAction {
  action: string;
  target: string;
  agent_type: string;
  status: string;
  timestamp: string;
}

export interface PerAgentStat {
  runs: number;
  cost: number;
}

export interface AgentActivity {
  configured?: boolean;
  message?: string;
  active_workflows: number;
  budget_usage_percent: number;
  last_completed: LastCompleted | null;
  recent_actions: AgentAction[];
  success_rate: number;
  per_agent_stats: Record<string, PerAgentStat>;
}

export interface SearchDayCount {
  day: string;
  count: number;
}

export interface SearchActivity {
  configured?: boolean;
  message?: string;
  searches_this_week: SearchDayCount[];
  top_queries: string[];
  crawl_count: number;
  crawl_success_rate: number;
}

export interface DashboardData {
  niche_counts: NicheCounts;
  design_counts: DesignCounts;
  listing_counts: ListingCounts;
  recent_activity: ActivityEvent[];
  stuck_niches: StuckNiche[];
  agent_activity: AgentActivity;
  search_activity: SearchActivity;
}

// Analytics types

export interface DesignAnalyticsItem {
  week: string;
  model_name: string;
  count: number;
}

export interface ListingAnalyticsItem {
  week: string;
  listings_ready: number;
  listings_published: number;
}

export interface AgentWeeklyItem {
  week: string;
  agent_type: string;
  runs: number;
  cost: number;
  success_rate: number;
  avg_duration: number;
}

export interface AgentAnalyticsData {
  weekly: AgentWeeklyItem[];
  per_agent_stats: Record<string, PerAgentStat>;
  avg_duration_per_template: Record<string, number>;
  avg_approval_wait: number;
  top_failure_reasons: string[];
}

export interface SearchWeeklyItem {
  week: string;
  searches: number;
  crawls: number;
  crawl_success_rate: number;
  top_query: string;
}

export interface SearchAnalyticsData {
  weekly: SearchWeeklyItem[];
  per_user: Record<string, number>;
  niche_benefit: Record<string, number>;
}

export interface DateRange {
  date_from: string;
  date_to: string;
}
