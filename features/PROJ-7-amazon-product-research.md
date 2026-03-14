# PROJ-7: Amazon Product Research

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-14

## Overview

A dedicated research page (inspired by MerchMatrix / Flying Research) for searching and filtering Amazon products before committing to a niche. Two modes: **Live Research** (triggers a Scrapy scrape via PROJ-16, fewer filters, fresh data) and **DB Research** (queries the existing product database with full filters and PostgreSQL full-text search). Amazon autocomplete proxy to avoid CORS. All filters applied server-side. Scrape engine is PROJ-16 (Scrapy + ScraperOps SDK).

## User Stories

1. As a member, I want to type a keyword and see Amazon autocomplete suggestions, so that I discover related search terms.
2. As a member, I want to switch between Live Research (fresh scrape) and DB Research (existing data), so that I can choose between speed and depth.
3. As a member, I want to filter products by BSR range, rating, reviews, price, and product type in DB Research mode, so that I find the sweet spot for niche viability.
4. As a member, I want to search across product title, brand, bullets, and description in DB Research mode, so that I find relevant products even if the keyword isn't the main title.
5. As a member, I want to see a BSR history chart for a product, so that I can evaluate trend direction over time.
6. As a member, I want to click "Open on Amazon" to see live search results, so that I can verify the data.
7. As a member, I want to hide official brand products, so that I only see POD-eligible opportunities.
8. As a member, I want to click a product and add its keyword as a Niche, so that the research pipeline is connected.

## Acceptance Criteria

1. Search input shows Amazon suggestions via proxy endpoint; debounced 300ms; max 10 suggestions shown.
2. **Live Research mode:** `POST /api/research/search/` triggers a Scrapy scrape job (via PROJ-16) if no completed `ProductSearchCache` exists for the keyword+marketplace within 24h. Returns job `cache_id` for polling.
3. **DB Research mode:** `GET /api/research/products/` returns all stored products matching the keyword using PostgreSQL full-text search (`SearchVector` + `SearchRank`) across `title`, `brand`, `feature_bullets`, `description`; full filter set applied server-side.
4. Mode toggle (Live / DB) is prominent in the UI; switching modes re-fetches data with the appropriate endpoint.
5. MUI DataGrid or Card grid shows per product: thumbnail, title, brand, BSR, rating, reviews count, price, product type, listed date.
6. Clicking a product row expands a detail panel showing: BSR history sparkline (last 30 days from BSRSnapshot), feature bullets, description excerpt.
7. Sort controls update `sort_by` query param; results re-fetch from server.
8. "Open on Amazon" button opens `https://www.amazon.{marketplace}/s?k={keyword}` in new tab (pure frontend).
9. "Add to Niche List" button calls `POST /api/niches/` with keyword as name; shows success toast via notistack.
10. Loading state (MUI LinearProgress) while scrape is pending.
11. Amazon autocomplete proxy has 60s Redis cache per (query, marketplace) pair.
12. Polling endpoint: `GET /api/research/search/{cache_id}/status/` returns current scrape status.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/research/suggestions/` | Member | Amazon autocomplete proxy |
| POST | `/api/research/search/` | Member | Live Research: trigger Scrapy scrape or return cached |
| GET | `/api/research/search/{cache_id}/status/` | Member | Poll scrape job status |
| GET | `/api/research/products/` | Member | DB Research: filter/sort all stored products |
| GET | `/api/research/products/{asin}/bsr-history/` | Member | BSR history snapshots for a product |

## Models

> Models are owned by PROJ-16. Defined here for reference.

### AmazonProduct
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| asin | CharField(20) | Unique per marketplace |
| marketplace | CharField choices [amazon_com, amazon_de, amazon_co_uk, amazon_fr, amazon_it, amazon_es] | |
| title | TextField | |
| brand | CharField(200) | |
| bsr | IntegerField | Current BSR (updated each scrape) |
| category | CharField(200) | |
| subcategory | CharField(200) | |
| price | DecimalField(10,2) | |
| rating | FloatField | |
| reviews_count | IntegerField | |
| listed_date | DateField(nullable) | |
| product_type | CharField choices [t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top, other] | |
| thumbnail_url | URLField | |
| product_url | URLField | |
| seller_name | CharField(200) | |
| feature_bullets | JSONField | List of bullet strings |
| description | TextField | |
| variants | JSONField | Size/color options |
| image_gallery | JSONField | List of image URLs |
| scraped_at | DateTimeField | Last full scrape timestamp |
| keywords | ManyToManyField(Keyword) | Search terms this ASIN appeared in |

### Keyword
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| keyword | CharField(200) | Unique per marketplace |
| marketplace | CharField | |

### ProductSearchCache
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| keyword | ForeignKey(Keyword) | |
| last_scraped_at | DateTimeField(nullable) | |
| status | CharField choices [pending, completed, failed] | |

### BSRSnapshot (owned by PROJ-16)
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| product | ForeignKey(AmazonProduct) | |
| bsr | IntegerField | |
| rating | FloatField | |
| price | DecimalField(10,2) | |
| recorded_at | DateTimeField | |

## Filters — DB Research (GET /api/research/products/)

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Full-text search across title, brand, bullets, description |
| `marketplace` | string | e.g., `amazon_com` |
| `bsr_min` / `bsr_max` | int | BSR range |
| `rating_min` / `rating_max` | float | e.g., 3.5–5.0 |
| `reviews_min` / `reviews_max` | int | Review count range |
| `price_min` / `price_max` | decimal | Price range |
| `date_from` / `date_to` | date | Listed date range |
| `product_type` | string (multi) | Comma-separated list |
| `subcategory` | string | icontains filter |
| `hide_official_brands` | bool | Exclude known brand ASINs (static fixture) |
| `exclude_words` | string | Comma-separated; exclude if title contains any (plain string, escaped) |
| `sort_by` | string | `bsr_asc`, `reviews_desc`, `rating_desc`, `price_asc`, `newest` |
| `page` / `page_size` | int | Pagination (default 50/page) |

## Filters — Live Research (POST /api/research/search/)

| Param | Type | Description |
|-------|------|-------------|
| `keyword` | string | Required; triggers scrape |
| `marketplace` | string | Required; e.g. `amazon_com` |
| `product_type` | string | Optional; user selects from dropdown (t_shirt, hoodie, pullover, zip_hoodie, long_sleeve, tank_top). UI maps to `search_index` + `hidden_keywords` spider args via product type config (see below) |
| `hide_official_brands` | bool | Optional |

### Product Type → Amazon Filter Mapping

UI needs a config mapping `product_type` selection to the raw Amazon search params passed to PROJ-16 spider. PROJ-16 accepts these as optional spider kwargs: `search_index`, `seller_filter`, `hidden_keywords`.

| Product Type | search_index | seller_filter | hidden_keywords |
|---|---|---|---|
| T-Shirt | `fashion-novelty` | `ATVPDKIKX0DER` | `Lightweight, Classic fit, Double-needle sleeve and bottom hem -Longsleeve -Raglan -Vneck -Tanktop` |
| Hoodie | `fashion-novelty` | `ATVPDKIKX0DER` | `Hoodie -Tanktop -Vneck -Longsleeve` |
| Pullover | `fashion-novelty` | `ATVPDKIKX0DER` | `Pullover Sweatshirt -Hoodie -Tanktop -Vneck` |
| Zip Hoodie | `fashion-novelty` | `ATVPDKIKX0DER` | `Zip Hoodie -Pullover -Tanktop` |
| Long Sleeve | `fashion-novelty` | `ATVPDKIKX0DER` | `Long Sleeve -Hoodie -Tanktop -Vneck` |
| Tank Top | `fashion-novelty` | `ATVPDKIKX0DER` | `Tank Top -Hoodie -Longsleeve` |

> `seller_filter=ATVPDKIKX0DER` = "Sold by Amazon" = Merch on Demand products only.
> `hidden_keywords` are appended to the Amazon search URL as `&hidden-keywords=...` to narrow results to specific product types.
> This mapping lives in the PROJ-7 API layer (not in PROJ-16 scraper). PROJ-16 receives raw params and passes them through.

## Amazon Autocomplete Proxy

- Amazon API: `https://completion.amazon.com/api/2017/suggestions?prefix={q}&mid={marketplace_id}&alias=aps`
- Django proxies this to avoid CORS restrictions in the browser
- Response: array of suggestion strings
- Redis cache: 60s TTL per (q, marketplace) pair

## Edge Cases

1. Amazon autocomplete returns empty → input works normally; no suggestions shown (no error).
2. Live Research scrape returns 0 products → empty state: "No products found for this keyword."
3. Scrape triggered while previous scrape for same keyword still running → return existing pending `ProductSearchCache`; no duplicate trigger.
4. `exclude_words` contains regex special chars → escape before filter; treat as plain string.
5. Large result set (500+ products) → pagination 50/page; no client-side JS filtering.
6. BSR `min` > `max` → 400 validation error.
7. `hide_official_brands` list is maintained as a static fixture (not user-configurable in MVP).
8. BSR history chart has < 2 data points → show single value with "Not enough history" label.
9. DB Research with no stored products for keyword → empty state with suggestion to run Live Research.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope)
- PROJ-5 (Niche List — "Add to Niche" action calls `POST /api/niches/`)
- PROJ-16 (Amazon Product Scraper — scrape engine, models, BSRSnapshot)

## Environment Variables Required

```
SCRAPEOPS_API_KEY=  # Used by PROJ-16 scraper engine
```
