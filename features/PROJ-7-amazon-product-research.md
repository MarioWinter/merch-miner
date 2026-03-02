# PROJ-7: Amazon Product Research

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27

## Overview

A dedicated research page (inspired by MerchMatrix / Flying Research) for searching and filtering Amazon products before committing to a niche. DB-first caching (< 24h) with live n8n + ScraperOps scrape as fallback. Amazon autocomplete proxy to avoid CORS. All filters applied server-side.

## User Stories

1. As a member, I want to type a keyword and see Amazon autocomplete suggestions, so that I discover related search terms.
2. As a member, I want to filter products by BSR range, rating, reviews, price, and product type, so that I find the sweet spot for niche viability.
3. As a member, I want cached results to load instantly for recently searched keywords, so that repeated research is fast.
4. As a member, I want to click "Open on Amazon" to see the live search results, so that I can verify the data.
5. As a member, I want to hide official brand products, so that I only see POD-eligible opportunities.
6. As a member, I want to click a product and add its niche to my Niche List, so that the research pipeline is connected.

## Acceptance Criteria

1. Search input shows Amazon suggestions via proxy endpoint; debounced 300ms; max 10 suggestions shown.
2. `POST /api/research/search/` returns cached results if `last_scraped_at` < 24h; else triggers n8n scrape + polls until complete.
3. All filter params are applied server-side (Django ORM); frontend sends filter state as query params or request body.
4. MUI DataGrid or Card grid shows: thumbnail, title, brand, BSR, rating, reviews, price, product type, listed date.
5. Sort controls update `sort_by` query param; results re-fetch from server.
6. "Open on Amazon" button opens `https://www.amazon.{marketplace}/s?k={keyword}` in new tab (pure frontend, no backend needed).
7. "Add to Niche List" button creates a Niche via `POST /api/niches/` with the keyword as name; shows success toast.
8. Loading state (MUI LinearProgress) while scrape is pending.
9. Amazon autocomplete proxy has 60s Redis cache per (query, marketplace) pair.
10. Scrape status polling endpoint: `GET /api/research/search/{cache_id}/status/` returns current status.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/research/suggestions/` | Member | Amazon autocomplete proxy |
| POST | `/api/research/search/` | Member | Search (cached or trigger scrape) |
| GET | `/api/research/search/{cache_id}/status/` | Member | Poll scrape status |
| GET | `/api/research/products/` | Member | Filter/sort stored products |

## Models

### AmazonProduct
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| asin | CharField(20) | |
| title | TextField | |
| brand | CharField(200) | |
| bsr | IntegerField | Best Seller Rank |
| category | CharField(200) | |
| subcategory | CharField(200) | |
| price | DecimalField(10,2) | |
| rating | FloatField | |
| reviews_count | IntegerField | |
| listed_date | DateField(nullable) | |
| product_type | CharField choices [t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top, other] | |
| thumbnail_url | URLField | |
| product_url | URLField | |
| marketplace | CharField choices [amazon_com, amazon_de, amazon_co_uk, amazon_fr, amazon_it, amazon_es] | |
| scraped_at | DateTimeField | |
| keyword | CharField(200) | Tag for lookup |

### ProductSearchCache
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| keyword | CharField(200) | Unique together with marketplace |
| marketplace | CharField | |
| last_scraped_at | DateTimeField(nullable) | |
| status | CharField choices [pending, completed, failed] | |

## Filters (GET /api/research/products/)

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Filter by keyword tag |
| `marketplace` | string | e.g., `amazon_com` |
| `bsr_min` / `bsr_max` | int | BSR range |
| `rating_min` / `rating_max` | float | e.g., 3.5–5.0 |
| `reviews_min` / `reviews_max` | int | Review count range |
| `price_min` / `price_max` | decimal | Price range |
| `date_from` / `date_to` | date | Listed date range |
| `product_type` | string (multi) | Comma-separated list |
| `subcategory` | string | icontains filter |
| `hide_official_brands` | bool | Exclude known brand ASINs |
| `exclude_words` | string | Comma-separated; exclude if title contains any |
| `sort_by` | string | `bsr_asc`, `reviews_desc`, `rating_desc`, `price_asc`, `newest` |
| `page` / `page_size` | int | Pagination (default 50/page) |

## Amazon Autocomplete Proxy

- Amazon API: `https://completion.amazon.com/api/2017/suggestions?prefix={q}&mid={marketplace_id}&alias=aps`
- Django proxies this to avoid CORS restrictions in the browser
- Response: array of suggestion strings
- Redis cache: 60s TTL per (q, marketplace) pair

## n8n Integration (Scrape Trigger)

Shares infrastructure with PROJ-6. Same n8n workflow or separate workflow for product search scrape.

- Django → n8n: `POST {N8N_RESEARCH_WEBHOOK_URL}` with `{"keyword": "...", "marketplace": "amazon_com", "cache_id": "<uuid>"}`
- n8n: ScraperOps → parse → INSERT into `AmazonProduct` → UPDATE `ProductSearchCache` status=completed

## Edge Cases

1. Amazon autocomplete returns empty → input works normally; no suggestions shown (no error).
2. Scrape returns 0 products → empty state: "No products found for this keyword."
3. Scrape triggered while previous scrape for same keyword still running → return existing pending `ProductSearchCache` (no duplicate trigger).
4. `exclude_words` contains regex special chars → escape before filter; treat as plain string.
5. Very large result set (500+ products) → pagination 50/page; no client-side JS filtering.
6. BSR `min` > `max` → 400 validation error.
7. `hide_official_brands` list is maintained as a static fixture (not user-configurable in MVP).

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope)
- PROJ-5 (Niche List — "Add to Niche" action calls `POST /api/niches/`)
- PROJ-6 (shares n8n scrape infrastructure; n8n workflow may be reused or forked)

## Environment Variables Required

Shares `N8N_RESEARCH_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET` with PROJ-6.
