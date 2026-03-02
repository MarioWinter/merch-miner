# PROJ-15: Analytics & Reporting

**Status:** Planned
**Priority:** P2
**Created:** 2026-02-27

## Overview

Workspace-level production analytics: design generation counts by model and week, listing production rate, and CSV export. Provides data to optimize the creative pipeline.

## User Stories

1. As an admin, I want to see how many designs were generated per week and per model, so that I can track production velocity.
2. As an admin, I want to see listing production rate (listings marked ready per week), so that I know how efficiently the team converts ideas to publishable content.
3. As an admin, I want to export analytics data as CSV, so that I can do custom analysis in a spreadsheet.
4. As a member, I want to filter analytics by date range, so that I can focus on a specific period.

## Acceptance Criteria

1. `GET /api/analytics/designs/` — returns design generation counts grouped by (model_name, week); filterable by `date_from`/`date_to`.
2. `GET /api/analytics/listings/` — returns listing production counts grouped by week (listings transitioned to status=ready); filterable by `date_from`/`date_to`.
3. `GET /api/analytics/designs/export/` — returns CSV via `StreamingHttpResponse`; columns: week, model, count.
4. `GET /api/analytics/listings/export/` — returns CSV; columns: week, listings_ready, listings_published.
5. All endpoints are workspace-scoped and admin-only.
6. Aggregations use DB-level GROUP BY with Django ORM (`annotate` + `TruncWeek`).
7. Frontend: MUI charts (bar chart for designs by model, line chart for listing rate) + date range pickers + export buttons.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/analytics/designs/` | Admin | Design counts by model/week |
| GET | `/api/analytics/listings/` | Admin | Listing production by week |
| GET | `/api/analytics/designs/export/` | Admin | CSV export: designs |
| GET | `/api/analytics/listings/export/` | Admin | CSV export: listings |

## Edge Cases

1. No data in date range → return empty array (not 404).
2. Very large date range (1+ year) → paginate or limit to 52 weeks max with warning.
3. CSV export with 0 rows → return CSV with headers only.

## Dependencies

- PROJ-9 (Design Generation — source data)
- PROJ-11 (Listing Generator — source data)
- PROJ-4 (Workspace & Membership — admin role check)
