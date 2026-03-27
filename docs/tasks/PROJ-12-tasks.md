# PROJ-12: Dashboard & Analytics — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `dashboard_app` — read-only aggregation layer, only own model: `ActivityEvent`
- **Redis cache 60s** on main dashboard endpoint — aggregations expensive, 60s TTL fresh enough
- **DB-level aggregations** — COUNT/GROUP BY, TruncWeek, no Python iteration
- **`ActivityEvent`** via `post_save` signals — automatic feed without modifying other apps
- **Admin-only analytics** — KPI dashboard for all, detailed charts for admins
- **CSV export** — `StreamingHttpResponse` (same pattern as PROJ-7/10)

---

## Phase 1: Backend Foundation

- [ ] Create `dashboard_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `dashboard_app/api/` + `dashboard_app/services/` subpackages
- [ ] Wire into `core/urls.py` under `/api/dashboard/`
- [ ] `ActivityEvent` model: UUID pk, `workspace` FK, `event_type` CharField(50) choices, `target_name` CharField(200), `target_id` UUIDField (nullable), `user` FK (nullable), `agent_type` CharField(50, blank=True), `metadata` JSONField, `created_at`
- [ ] Indexes: `(workspace, created_at)` on ActivityEvent
- [ ] Initial migration
- [ ] Admin registration
- [ ] Redis cache config in `settings.py → CACHES` (if not already set)

---

## Phase 2: Activity Event Signals

- [ ] `signals.py`: `post_save` handlers that create `ActivityEvent` records
- [ ] Niche signals: niche_created, niche_archived, niche_status_changed
- [ ] Research signals: research_completed, research_failed
- [ ] Idea signals: idea_created, idea_adapted, idea_approved, idea_rejected
- [ ] Design signals: design_generated, design_approved
- [ ] Listing signals: listing_generated, listing_ready
- [ ] Upload signals: upload_completed, upload_failed
- [ ] Agent events: `agent_type` field set from AgentActionLog (PROJ-18, graceful if not available)
- [ ] Register signals in `apps.py → ready()`

---

## Phase 3: Backend Services

- [ ] `services/kpi_aggregator.py`: niche counts by status group (research/design/publish/live/done/archived), design counts (total + approved), listing counts (total + ready). All DB-level COUNT. Workspace-scoped
- [ ] `services/analytics_aggregator.py`: design counts grouped by (model_name, week) via `TruncWeek`. Listing counts by week. Date range filter (`date_from`, `date_to`). Max 52 weeks
- [ ] `services/activity_feed.py`: last 20 `ActivityEvent` records for workspace. Serialized with user name + agent_type
- [ ] `services/stuck_detector.py`: niches where `updated_at < now() - 7 days` AND status not in (archived, winner, loser). Returns id, name, status, days_stuck
- [ ] Agent analytics aggregator: reads from `AgentActionLog` (PROJ-18). Cost/week, per-agent stats, success rate, avg duration. Returns placeholder if PROJ-18 not configured
- [ ] Search analytics aggregator: reads from `SearchUsageLog` (PROJ-17). Searches/day, top queries, crawl stats. Returns placeholder if PROJ-17 not configured

---

## Phase 4: API Endpoints

### Main Dashboard
- [ ] AC-1: `GET /api/dashboard/` — main dashboard. Redis-cached 60s. Returns: niche_counts, design_counts, listing_counts, recent_activity, stuck_niches, agent_activity, search_activity. Member access
- [ ] AC-2: Response matches full JSON shape from spec (niche_counts, design_counts, listing_counts, recent_activity, stuck_niches, agent_activity, search_activity)
- [ ] AC-3: All aggregations use DB-level COUNT/GROUP BY (not Python iteration)
- [ ] Cache invalidation: signal-based cache bust on write to Niche, Design, Listing, UploadJob models. `cache.delete('dashboard:{workspace_id}')` in signals

### Analytics Endpoints (Admin only, date-filterable)
- [ ] AC-4: `GET /api/dashboard/analytics/designs/` — design generation counts grouped by (model_name, week) via TruncWeek. Filterable: date_from, date_to. Max 52 weeks
- [ ] AC-5: `GET /api/dashboard/analytics/listings/` — listing production counts grouped by week. Filterable: date_from, date_to
- [ ] AC-6: `GET /api/dashboard/analytics/agent/` — agent usage: cost/week, workflows/week, success rate, per agent_type breakdown, avg duration per template, avg approval wait, top failure reasons. Filterable
- [ ] AC-7: `GET /api/dashboard/analytics/search/` — search usage: searches/week, crawls/week, success rate, top queries, per-user attribution, niche benefit. Filterable

### CSV Export Endpoints (Admin only)
- [ ] AC-8: `GET /api/dashboard/analytics/designs/export/` — CSV: week, model, count. StreamingHttpResponse
- [ ] AC-9: `GET /api/dashboard/analytics/listings/export/` — CSV: week, listings_ready, listings_published
- [ ] AC-10: `GET /api/dashboard/analytics/agent/export/` — CSV: week, agent_type, runs, cost, success_rate, avg_duration
- [ ] AC-11: `GET /api/dashboard/analytics/search/export/` — CSV: week, searches, crawls, crawl_success_rate, top_query

### Edge Case Handling
- [ ] EC-1: Empty workspace (no data) → all counts 0, empty arrays, charts render without error
- [ ] EC-2: Cache miss → compute fresh aggregation, cache result 60s
- [ ] EC-5: Very large date range (>52 weeks) → limit to 52 weeks, return warning in response
- [ ] EC-6: CSV export with 0 rows → CSV with headers only
- [ ] EC-7: Agent not configured → agent_activity returns placeholder `{"configured": false, "message": "Agent not set up"}`
- [ ] EC-8: Search not configured → search_activity returns placeholder `{"configured": false, "message": "Search not connected"}`
- [ ] Signal handler failure → graceful degradation: dashboard shows stale cached data, logs error

---

## Phase 5: Serializers

- [ ] `DashboardSerializer` — full response shape (niche_counts, design_counts, listing_counts, recent_activity, stuck_niches, agent_activity, search_activity)
- [ ] `ActivityEventSerializer` — event_type, target_name, user display_name, agent_type, timestamp
- [ ] `StuckNicheSerializer` — id, name, status, days_stuck
- [ ] `DesignAnalyticsSerializer` — week, model_name, count
- [ ] `ListingAnalyticsSerializer` — week, listings_ready, listings_published
- [ ] `AgentAnalyticsSerializer` — per-agent stats, cost breakdown, success rate
- [ ] `SearchAnalyticsSerializer` — searches/day, top queries, crawl stats

---

## Phase 6: Frontend — State & Services

- [ ] RTK Query `dashboardApi` slice (`store/dashboardSlice.ts`): getDashboard, getDesignAnalytics, getListingAnalytics, getAgentAnalytics, getSearchAnalytics
- [ ] Cache tags: `Dashboard` (invalidated on 60s interval via `pollingInterval`)
- [ ] Register slice in `store/index.ts`
- [ ] TypeScript types: DashboardData, NicheCounts, ActivityEvent, StuckNiche, DesignAnalytics, ListingAnalytics, AgentActivity, SearchActivity
- [ ] `useDashboardData` hook: fetches main dashboard, auto-refresh 60s
- [ ] `useAnalytics` hook: fetches analytics endpoints with date range params
- [ ] `useCSVExport` hook: triggers export download per widget

---

## Phase 7: Frontend — Dashboard Page

- [ ] `DashboardView.tsx`: scrollable page, route `/dashboard`. KPI cards → Funnel → Activity Feed → Stuck Niches → Charts
- [ ] `KPICards.tsx`: MUI Card grid — niche pipeline counts, design total/approved, listing total/ready. Color-coded per status group
- [ ] `PipelineFunnel.tsx`: visual funnel — Research → Design → Publish → Live. Width proportional to count. MUI styled boxes or simple SVG
- [ ] `ActivityFeed.tsx`: MUI List, last 20 events. Scrollable. Agent events: robot emoji + agent display_name
- [ ] `ActivityItem.tsx`: avatar (user photo or robot emoji), event description, relative timestamp
- [ ] `StuckNichesWidget.tsx`: MUI Card with list — niche name, status chip, "X days stuck", click → navigate to niche detail
- [ ] `DesignAnalyticsChart.tsx`: @mui/x-charts BarChart — designs by model/week. Stacked bars per model. CSV export icon
- [ ] `ListingAnalyticsChart.tsx`: @mui/x-charts LineChart — listings ready/week. CSV export icon
- [ ] `AgentActivityWidget.tsx`: active workflows count, budget usage percentage (MUI LinearProgress), per-agent stats table, success rate. CSV export icon
- [ ] `SearchActivityWidget.tsx`: searches/day bar chart, top 5 queries as chips, crawl stats. CSV export icon
- [ ] `DateRangePicker.tsx`: two MUI DatePickers (from/to). Changes filter all analytics charts simultaneously
- [ ] `CSVExportButton.tsx` (reusable): small icon button — triggers axios blob download for corresponding export endpoint
- [ ] `PlaceholderWidget.tsx`: "Agent not set up" / "Search not connected" message when PROJ-18/17 not configured
- [ ] Route `/dashboard` registered in `App.tsx` (workspace home)

---

## Phase 8: i18n

- [ ] `dashboard.page.*` — page title
- [ ] `dashboard.kpi.*` — niche/design/listing count labels
- [ ] `dashboard.funnel.*` — stage labels (Research, Design, Publish, Live)
- [ ] `dashboard.activity.*` — feed title, event type descriptions, agent label
- [ ] `dashboard.stuck.*` — widget title, days stuck label, no stuck message
- [ ] `dashboard.analytics.*` — chart titles, date range labels, no data message
- [ ] `dashboard.export.*` — export button tooltip
- [ ] `dashboard.placeholder.*` — agent/search not configured messages
- [ ] All 5 locales: EN, DE, FR, ES, IT

---

## Phase 9: Tests

### Backend

- [ ] ActivityEvent creation via signals: niche_created, design_generated, etc.
- [ ] Dashboard endpoint: returns correct counts, cached 60s
- [ ] Analytics endpoints: correct weekly aggregations, date range filter, max 52 weeks
- [ ] CSV exports: correct columns, streams, headers-only on empty
- [ ] Stuck niches: correct >7 day detection
- [ ] Admin-only analytics: member gets 403
- [ ] Agent/Search placeholders when not configured
- [ ] Workspace isolation on all endpoints

### Frontend

- [ ] DashboardView: renders all sections
- [ ] KPICards: correct counts displayed
- [ ] ActivityFeed: shows events with correct avatars
- [ ] Charts: render with data, empty state on no data
- [ ] DateRangePicker: filters all charts
- [ ] CSVExportButton: triggers download
- [ ] TypeScript + ESLint + Ruff: 0 errors

---

## Verification Checklist

- [ ] `dashboard_app` registered, migrations applied
- [ ] ActivityEvent signals fire on niche/idea/design/listing/upload changes
- [ ] Dashboard endpoint returns correct KPIs (cached 60s)
- [ ] Pipeline funnel visualizes niche status distribution
- [ ] Activity feed shows last 20 events with user/agent distinction
- [ ] Stuck niches detected (>7 days unchanged)
- [ ] Analytics charts: design by model/week, listing by week
- [ ] Date range picker filters all charts
- [ ] CSV export per widget (correct columns, streaming)
- [ ] Admin-only analytics endpoints
- [ ] Placeholder widgets for unconfigured Agent/Search
- [ ] All tests pass, lint clean
