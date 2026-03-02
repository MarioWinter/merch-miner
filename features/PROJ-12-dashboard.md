# PROJ-12: Dashboard

**Status:** Planned
**Priority:** P1
**Created:** 2026-02-27

## Overview

Workspace home screen. Shows KPI counts, pipeline funnel by niche status, recent activity feed, and a "stuck niches" widget for niches with no activity in 7+ days. All aggregations computed at the DB level with Redis cache.

## User Stories

1. As a member, I want to see a summary of my workspace's pipeline (niches by status), so that I have an at-a-glance view of progress.
2. As a member, I want to see counts of designs and listings, so that I know how productive the team has been.
3. As a member, I want to see a recent activity feed, so that I know what my teammates have been doing.
4. As an admin, I want to see which niches have been stuck for 7+ days, so that I can unblock or archive them.

## Acceptance Criteria

1. `GET /api/dashboard/` returns:
   - Niche counts grouped by status (new, researched, in_design, listed, archived)
   - Total designs count (all statuses) + approved designs count
   - Total listings count + ready listings count
   - Recent activity list (max 20 events): niche created/updated, research completed, ideas generated, design approved, listing ready
   - Stuck niches list: niches with `updated_at` older than 7 days and status not in [listed, archived]
2. Response is Redis-cached for 60 seconds; cache invalidated on any write to relevant models.
3. Aggregations use DB-level COUNT/GROUP BY (not Python iteration).
4. Frontend: MUI Card grid for KPI counts, pipeline funnel visualization, MUI List for activity feed.
5. "Stuck niches" widget shows niche name, current status, days since last update, quick-link to niche detail.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/` | Member | Workspace dashboard data |

## Response Schema

```json
{
  "niche_counts": {"new": 5, "researched": 3, "in_design": 2, "listed": 10, "archived": 1},
  "design_counts": {"total": 45, "approved": 12},
  "listing_counts": {"total": 12, "ready": 8},
  "recent_activity": [
    {"event": "niche_created", "niche_name": "...", "user": "...", "timestamp": "..."}
  ],
  "stuck_niches": [
    {"id": "...", "name": "...", "status": "researched", "days_stuck": 9}
  ]
}
```

## Edge Cases

1. Empty workspace (no niches) → all counts are 0; empty arrays for activity and stuck niches.
2. Cache miss (first request or after invalidation) → compute fresh; cache result.
3. Activity feed: if no activity in workspace → return empty array (no error).

## Dependencies

- PROJ-4 (Workspace & Membership)
- PROJ-5 (Niche List)
- PROJ-8 (Idea Generation — activity events)
- PROJ-9 (Design Generation — activity events)
- PROJ-11 (Listing Generator — activity events)
