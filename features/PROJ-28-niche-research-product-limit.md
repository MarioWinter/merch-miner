# PROJ-28: Niche Research Product Limit

## Status: Planned
**Created:** 2026-05-08
**Last Updated:** 2026-05-08

## Dependencies
- Requires: PROJ-6 (Niche Deep Research) — extends the LangGraph workflow
- Requires: PROJ-7 (Amazon Product Research) — relies on existing scraper + AmazonProduct model
- Related: PROJ-16 (Amazon Product Scraper) — uses existing `amazon_search_product` spider

## Problem
Today the AI Research workflow (`niche_research_app/graph/scrape.py`) loads **all** products in the DB matching the niche keyword without limit or ordering. LLM costs scale linearly with product count. When the DB is empty, only the lightweight `amazon_search_page` spider runs (pages 1–2, no product detail pages), which produces shallower analyses than the deep scrape used elsewhere.

## Goal
Add a user-configurable product limit on the Niche Research view to control cost per analysis, and switch the empty-DB fallback to the deep scraper so first-time analyses get rich product data.

## User Stories
- As a POD researcher, I want to set how many products the AI analyzes per run, so that I can control LLM cost vs. analysis depth.
- As a POD researcher, I want a sensible default (50) pre-filled, so that I don't have to decide on every run.
- As a POD researcher, when a niche has no products in the DB yet, I want a deep scrape (search + detail pages) to run automatically, so that the first AI analysis has full product data.
- As a POD researcher, I want the system to pick the bestselling products (lowest BSR) when more are available than my limit, so that the analysis reflects market winners, not random samples.
- As a POD researcher, I want the limit to be ad-hoc per run (not persisted), so that I can flex between quick spot-checks and deep analyses without changing settings.

## Acceptance Criteria
- [ ] AC-1: Niche Research view shows a `TextField type="number"` labeled "Produkte" / "Products" next to the Marketplace and Product-Type selectors, pre-filled with **50**.
- [ ] AC-2: Input enforces **min 10**, **max 200**, **step 10** via native attributes.
- [ ] AC-3: Auto-clamp on blur — values < 10 become 10, values > 200 become 200, empty/non-numeric becomes 50.
- [ ] AC-4: Trigger button stays enabled regardless of input state (clamping handles invalid values silently).
- [ ] AC-5: AI Research POST request includes `product_limit: number` alongside `marketplace` and `product_type`.
- [ ] AC-6: Backend selects products via `AmazonProduct.objects.filter(keywords=...).order_by(F('bsr').asc(nulls_last=True))[:product_limit]`.
- [ ] AC-7: When DB has 0 products for the keyword, backend triggers the **`amazon_search_product`** spider (deep scraper) with `pages_total=2`, instead of `amazon_search_page`.
- [ ] AC-8: `product_limit` applies identically when `force_refresh=true` (same selection logic on re-run).
- [ ] AC-9: `product_limit` is **not persisted** — every page load shows default 50.
- [ ] AC-10: New i18n key `research.productLimit.label` exists for "Produkte" / "Products".

## Edge Cases
- [ ] EC-1: BSR is NULL on some products → `nulls_last=True` ensures BSR-less products land at the end and are only selected when ranked products don't fill the limit.
- [ ] EC-2: User requests `limit=200` but DB has only 30 products → analysis runs with the 30 available; no automatic re-scrape.
- [ ] EC-3: Deep scrape returns fewer products than `limit` (typical: ~32 from 2 pages × ~16 results) → analysis runs with what came back; no retry loop.
- [ ] EC-4: Brand filter in `vision_analyze.py` shrinks the set below `limit` → analysis proceeds with filtered subset; no re-fetch.
- [ ] EC-5: Existing scrape-progress UI is reused for the empty-DB case (deep scraper takes longer than the search-page-only mode — UI must remain coherent).
- [ ] EC-6: Scrape fails or returns 0 products → workflow fails with a meaningful error message; no infinite wait.
- [ ] EC-7: Concurrent triggers with different limits (rapid double-click) → last submission wins; backend prevents parallel runs per niche.
- [ ] EC-8: User submits with field empty → onBlur restores 50 before submit fires.

## Out of Scope
- Persisting `product_limit` per workspace or per niche.
- Cost tooltip / credit-cost preview on the input (deferred — credits system not yet implemented).
- Selection strategies other than BSR ASC (no random / reviews-based / mixed mode).
- Re-scraping when DB has fewer products than requested limit (use what's available).
- Adjusting `pages_total` based on requested limit (always 2 for empty-DB deep scrape).

## Technical Requirements
- Performance: trigger POST stays < 200ms (no synchronous DB heavy lifting added on the request path).
- Security: existing workspace-auth (CookieJWTAuthentication + IsAuthenticated + workspace scoping) must remain unchanged.
- Backwards compat: requests without `product_limit` must continue to work; backend defaults to 50 server-side.
- i18n: German + English label keys.

## Files Touched (informational, finalized in /architecture)
- Frontend: `frontend-ui/src/views/niches/research/partials/ResearchTriggerButton.tsx`
- Frontend types: `frontend-ui/src/views/niches/research/types/index.ts` (add `product_limit` to `ResearchTriggerParams`)
- Frontend i18n: `frontend-ui/src/i18n/locales/{de,en}/translation.json`
- Backend trigger view: `django-app/niche_research_app/api/views.py` (accept and validate `product_limit`)
- Backend serializer: `django-app/niche_research_app/api/serializers.py` (research trigger payload)
- Backend tasks: `django-app/niche_research_app/tasks.py` (switch fallback spider, propagate limit)
- Backend workflow: `django-app/niche_research_app/graph/scrape.py` (apply order_by + slice)
- Backend model: `django-app/niche_research_app/models.py` (NicheResearch may need `product_limit` field for traceability)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
