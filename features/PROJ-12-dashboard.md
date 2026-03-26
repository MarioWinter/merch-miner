# PROJ-12: Dashboard & Analytics

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27
**Updated:** 2026-03-27

## Overview

Workspace home screen combining real-time KPIs with historical analytics on a single scrollable page. No separate analytics feature — everything lives here. Shows: pipeline funnel, design/listing production counts, recent activity feed, stuck niches, agent activity, web search usage, and historical trend charts with CSV export per widget.

All aggregations computed at DB level with Redis cache (60s). Historical charts use `TruncWeek` aggregation. Each widget has an optional CSV export button.

**Absorbs former PROJ-15 (Analytics & Reporting) — no separate analytics page needed for a small team.**

## User Stories

### KPIs & Pipeline
1. As a member, I want to see a summary of my workspace's pipeline (niches by status group), so I have an at-a-glance view of progress.
2. As a member, I want to see counts of designs (total + approved) and listings (total + ready), so I know how productive the team has been.
3. As a member, I want to see a pipeline funnel visualization showing how niches flow through stages, so I can spot bottlenecks.

### Activity Feed
4. As a member, I want to see a recent activity feed (last 20 events), so I know what my teammates and the Agent have been doing.
5. As a member, I want Agent events in the feed styled with Agent avatar + name (e.g. "🤖 Chief started Full Pipeline for Camping Dad"), so I can distinguish Agent actions from human actions.

### Stuck Niches
6. As an admin, I want to see which niches have been stuck for 7+ days, so I can unblock or archive them.

### Design Analytics
7. As an admin, I want to see design generation counts by AI model and by week as a bar chart, so I can track production velocity and model usage.
8. As an admin, I want to export design analytics as CSV, so I can do custom analysis.

### Listing Analytics
9. As an admin, I want to see listing production rate (listings marked ready per week) as a line chart, so I know conversion efficiency.
10. As an admin, I want to export listing analytics as CSV.

### Agent Activity
11. As a member, I want to see Agent activity: active workflows count, budget usage percentage, last completed workflow, success/failure rate this week.
12. As an admin, I want to see per Sub-Agent statistics: run count + cost breakdown per agent type (Research: 12 runs / $2.40, Design: 8 runs / $5.60 etc.).
13. As an admin, I want to see Agent workflow efficiency: average duration per workflow template, average approval wait time, top 5 failure reasons.
14. As an admin, I want to export Agent analytics as CSV.

### Web Search Activity
15. As a member, I want to see search activity: searches per day this week as a bar chart, top 5 search queries.
16. As a member, I want to see Deep Crawl stats: count + success rate.
17. As an admin, I want to see per-user search attribution: who searches most, which niches benefit most from web search (keywords with source=web_search counted).
18. As an admin, I want to export search analytics as CSV.

### Date Filtering
19. As an admin, I want to filter all analytics charts by date range, so I can focus on a specific period.

## Acceptance Criteria

### Dashboard API

- [ ] AC-1: `GET /api/dashboard/` returns all dashboard data in one response. Redis-cached for 60 seconds. Cache invalidated on any write to relevant models.
- [ ] AC-2: Response includes:

```json
{
  "niche_counts": {"research": 5, "design": 3, "publish": 2, "live": 10, "done": 4, "archived": 1},
  "design_counts": {"total": 45, "approved": 12},
  "listing_counts": {"total": 12, "ready": 8},
  "recent_activity": [
    {"event": "niche_created", "niche_name": "...", "user": "...", "agent_type": null, "timestamp": "..."}
  ],
  "stuck_niches": [
    {"id": "...", "name": "...", "status": "researched", "days_stuck": 9}
  ],
  "agent_activity": {
    "active_workflows": 2,
    "budget_usage_percent": 65,
    "last_completed": {"niche": "...", "template": "full_pipeline", "duration_minutes": 12},
    "recent_actions": [{"action": "...", "target": "...", "agent_type": "design", "status": "completed", "timestamp": "..."}],
    "success_rate": 0.87,
    "per_agent_stats": {"research": {"runs": 12, "cost": 2.40}, "design": {"runs": 8, "cost": 5.60}}
  },
  "search_activity": {
    "searches_this_week": [{"day": "2026-03-24", "count": 8}, {"day": "2026-03-25", "count": 12}],
    "top_queries": ["camping trends", "nurse humor", "dad jokes"],
    "crawl_count": 15,
    "crawl_success_rate": 0.93
  }
}
```

- [ ] AC-3: All aggregations use DB-level COUNT/GROUP BY (not Python iteration).

### Analytics Endpoints (filterable by date range)

- [ ] AC-4: `GET /api/dashboard/analytics/designs/` — design generation counts grouped by (model_name, week). Filterable by `date_from`/`date_to`. Admin only.
- [ ] AC-5: `GET /api/dashboard/analytics/listings/` — listing production counts grouped by week. Filterable. Admin only.
- [ ] AC-6: `GET /api/dashboard/analytics/agent/` — Agent usage: cost/week, workflows/week, success rate, per agent_type breakdown, avg duration per template, avg approval wait, top failure reasons. Filterable. Admin only.
- [ ] AC-7: `GET /api/dashboard/analytics/search/` — Search usage: searches/week, crawls/week, success rate, top queries, per-user attribution, niche benefit (niches with most web_search keywords). Filterable. Admin only.

### CSV Export

- [ ] AC-8: `GET /api/dashboard/analytics/designs/export/` — CSV: week, model, count.
- [ ] AC-9: `GET /api/dashboard/analytics/listings/export/` — CSV: week, listings_ready, listings_published.
- [ ] AC-10: `GET /api/dashboard/analytics/agent/export/` — CSV: week, agent_type, runs, cost, success_rate, avg_duration.
- [ ] AC-11: `GET /api/dashboard/analytics/search/export/` — CSV: week, searches, crawls, crawl_success_rate, top_query.

### Frontend

- [ ] AC-12: Single scrollable Dashboard page. MUI Card grid for KPI counts at top. Charts below (MUI-compatible chart library). Activity Feed as MUI List. Stuck Niches widget. Agent + Search widgets.
- [ ] AC-13: Each analytics chart has a small CSV export icon button.
- [ ] AC-14: Date range picker (MUI DatePicker) filters all analytics charts simultaneously.
- [ ] AC-15: "Stuck niches" widget: niche name, current status, days since last update, quick-link to niche detail / Kanban card.
- [ ] AC-16: Agent events in Activity Feed styled with Agent avatar emoji + display_name from PROJ-18 AgentConfig.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/` | Member | Dashboard KPIs + activity + agent + search |
| GET | `/api/dashboard/analytics/designs/` | Admin | Design counts by model/week |
| GET | `/api/dashboard/analytics/listings/` | Admin | Listing production by week |
| GET | `/api/dashboard/analytics/agent/` | Admin | Agent usage analytics |
| GET | `/api/dashboard/analytics/search/` | Admin | Search usage analytics |
| GET | `/api/dashboard/analytics/designs/export/` | Admin | CSV: designs |
| GET | `/api/dashboard/analytics/listings/export/` | Admin | CSV: listings |
| GET | `/api/dashboard/analytics/agent/export/` | Admin | CSV: agent |
| GET | `/api/dashboard/analytics/search/export/` | Admin | CSV: search |

## Edge Cases

- [ ] EC-1: Empty workspace (no niches) → all counts 0, empty arrays, no charts.
- [ ] EC-2: Cache miss → compute fresh, cache result.
- [ ] EC-3: No activity in workspace → empty activity feed (no error).
- [ ] EC-4: No data in date range → empty chart (not 404).
- [ ] EC-5: Very large date range (1+ year) → limit to 52 weeks max with warning.
- [ ] EC-6: CSV export with 0 rows → CSV with headers only.
- [ ] EC-7: Agent not configured (no PROJ-18) → agent_activity section shows "Agent not set up" placeholder.
- [ ] EC-8: Search not configured (no PROJ-17) → search_activity section shows "Search not connected" placeholder.

## Dependencies

- PROJ-4 (Workspace & Membership — admin role check)
- PROJ-5 (Niche List — niche counts)
- PROJ-8 (Idea Generation — activity events)
- PROJ-9 (Design Generation — design counts, model tracking)
- PROJ-11 (Publish — listing counts, upload events)
- PROJ-17 (Web Search — SearchUsageLog for search analytics)
- PROJ-18 (Agent — AgentActionLog for agent analytics)
