# PROJ-6: Niche Deep Research (LangGraph)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-17

## Overview

Trigger an AI research workflow for a given niche. A **LangGraph StateGraph** orchestrates the pipeline: (1) scrape Amazon products via PROJ-16 Scrapy engine, (2) analyze each product thumbnail via vision LLM (slogan extraction + emotional analysis), (3) aggregate all per-product analyses into a niche identity profile using an LLM agent with SearXNG web search, (4) generate keyword recommendations. The workflow runs as a **django-rq background job** with a **PostgreSQL checkpointer** for fault tolerance and resume-on-failure. Migrates the existing n8n niche analyser workflow to LangGraph. No n8n dependency.

### Why LangGraph

- **StateGraph** — explicit node transitions, easy to reason about and extend
- **PostgreSQL checkpointer** — durable state snapshots; failed runs resume from last successful node
- **Structured output** — Pydantic `BaseModel` + `llm.with_structured_output()` for reliable JSON from LLM
- **Thread-based execution** — each research run is its own thread (`thread_id = research_id`)
- **Send API** — fan-out parallel vision analysis per product, fan-in results

## User Stories

1. As a member, I want to click "AI Research" on a niche, so that Amazon product data and AI analysis are automatically gathered.
2. As a member, I want to see a progress indicator while research is running, so that I know the system is working.
3. As a member, I want to see the niche analysis displayed cleanly — summary, sentiment, emotions, emotional archetypes, emotional reality, design concepts, design aesthetics — so I can evaluate whether to advance the niche.
4. As a member, I want to see which patterns are ACTIVE for this niche (with context why), so I understand the psychological drivers.
5. As a member, I want to see keyword suggestions (short-tail + long-tail) from the research, so I can use them in my listing later.
6. As a member, I want to see related niches in my workspace that share ≥2 active patterns, so I can find proven slogans to adapt.
7. As a member, I want to see an error message if research fails, so I can retry or investigate.

## Acceptance Criteria

### Workflow Trigger
1. `POST /api/niches/{id}/research/` — creates `NicheResearch` (status=pending) → enqueues LangGraph workflow job via django-rq → returns research record. Returns 409 if a pending/running research already exists for this niche. Any workspace member can trigger.
2. The django-rq job runs the LangGraph StateGraph synchronously in the worker process.

### LangGraph Workflow Nodes
3. **Node `scrape`**: Calls PROJ-16 `scrape_search_page_job` (search-page-only mode — no detail page follow) with the niche keyword + marketplace. Updates `NicheResearch.status = running`. Waits for `ProductSearchCache.status = completed` by polling DB (max 10 min, 5s interval). On timeout → raise error → node retry. Uses `AmazonSearchPageSpider` for fast listing-level data (title, ASIN, price, rating, reviews, brand, thumbnail). Writes list of product ASINs to state.

4. **Node `vision_analyze`**: Fan-out using LangGraph Send API — one sub-invocation per product in parallel. Each sub-invocation calls the vision LLM (`OPENROUTER_VISION_MODEL`) with the product thumbnail URL + title/brand context. Extracts: `slogan_text`, `meaning_context`, `visual_style`, `graphic_elements`, `layout_composition`. Runs a niche-match check (is this product relevant to the niche keyword?). Filters out non-matching products. Fan-in collects all per-product vision results. Saves results to `NicheProductVisionAnalysis` table. Writes aggregated results to state.

5. **Node `analyze`**: LLM Agent (`OPENROUTER_MODEL`) with **SearXNG web search tool** (via `SEARXNG_BASE_URL`). Agent receives all per-product vision analyses aggregated. Mandatorily calls SearXNG ≥3 times (niche culture/slang, Reddit lifestyle context, terminology). Calls `llm.with_structured_output(NicheAnalysisSchema)` after enrichment. Evaluates all 16 predefined emotional patterns (see below) — each `present: true/false` with `context`. Saves result to `NicheAnalysis` table.

6. **Node `keywords`**: Calls LLM via `llm.with_structured_output(NicheKeywordSchema)` with product titles + analysis context + `SearchKeywordResult.top_focus_keywords` + `top_long_tail_keywords` as seed data. Saves result to `NicheKeywordAnalysis` table.

7. **Node `finalize`**: Sets `NicheResearch.status = completed`, `completed_at = now()`. Updates niche `status = deep_research`.

8. Each node writes its output to the LangGraph state. The PostgreSQL checkpointer snapshots state after each node — if the job crashes, it resumes from the last successful node.

### The 16 Emotional Patterns (Predefined Enum)

These are hardcoded in the LLM system prompt as a fixed list. The `analyze` node evaluates every pattern:

| # | Pattern Name | Description |
|---|-------------|-------------|
| 1 | IDENTITY_DECLARATION | "I am X", role pride |
| 2 | GROUP_LEADER | Leadership role, title ("CEO", "Chief", etc.) |
| 3 | TRIBE_COMMUNITY | "We"-language, belonging, community |
| 4 | FUNNY_ACTIVITY | Humorous activity/action |
| 5 | CROSS_NICHE_EVENTS | Seasonal/occasion variants (e.g. holidays) |
| 6 | CROSS_NICHE_MASHUP | Combining interests/topics |
| 7 | ADDICTION_OBSESSION | Exaggerated passion/"addiction" |
| 8 | VINTAGE_LEGACY | "Since [year]", tradition, retro |
| 9 | ACHIEVEMENT_GAMIFIED | Certificates, levels, badges |
| 10 | JOB_PROFESSION_PARODY | Jobs/departments humorous |
| 11 | RELATIONSHIP_HUMOR | Partner/family, domestic dynamics |
| 12 | BOUNDARY_GATEKEEPING | Setting limits, "No", protecting energy |
| 13 | ENDURANCE_SURVIVAL | "I survived X", perseverance |
| 14 | COMPETENCE_EXPERTISE | Skills, authority, "only I can do this" |
| 15 | CHAOS_CONTROL | Managing chaos, order in disorder |
| 16 | SELF_CARE_PRIORITIES | Self-prioritization, protecting own time/energy |

### Structured Output Schemas (Pydantic)
9. `VisionAnalysisSchema` (per product): `slogan_text` (str), `meaning_context` (str), `visual_style` (str), `graphic_elements` (str), `layout_composition` (str), `is_niche_match` (bool).

10. `NicheAnalysisSchema`: `niche_summary` (str), `sentiment` (str enum: positive/neutral/negative), `primary_emotions` (list[str], 3–5 items), `emotional_archetype` (list[str], 1–2 items), `example_keywords` (list[str], 5–7 items), `pattern_analysis` (list[PatternItem] — all 16 patterns, where `PatternItem = {name: PatternEnum, present: bool, context: str}`), `emotional_reality` (str, single line), `design_concepts` (str, single line), `dominant_design_aesthetics` (str, single line).

11. `NicheKeywordSchema`: `main_short_tail` (list[str]), `main_long_tail` (list[str]), `all_keywords_flat` (str), `top_focus_keywords` (list[str]), `top_long_tail_keywords` (list[str]).

### Polling & Display
12. Frontend polls `GET /api/niches/{id}/research/latest/` every 5 seconds while status is pending or running. Frontend stops polling after **20 minutes** and shows an error state.
13. MUI LinearProgress shown while polling. When complete: summary card + pattern cards + keyword chips + related niches section replace the progress bar.
14. Active patterns (`present=true`) shown prominently as highlighted cards with `context` text. Inactive patterns (`present=false`) shown collapsed/grayed.
15. `related_niches` computed server-side at read time: up to 5 other niches in the same workspace where `NicheAnalysis.pattern_analysis` contains ≥2 matching active patterns. Each entry: `{id, name, shared_patterns: ["PATTERN_NAME", ...]}`.

### Error Handling
16. Node-level failure → LangGraph retries the node up to 2 times before propagating error.
17. After all retries exhausted → `NicheResearch.status = failed`, `error_message` populated with node name + exception detail.
18. Frontend shows retry button that triggers a new `POST /api/niches/{id}/research/`.
19. Research timeout (workflow running > 15 min with no node completion) → background watchdog job (django-rq scheduled, runs every 5 min) sets status=failed.
20. Vision analysis: if thumbnail URL is unavailable/unreachable → skip that product (log warning, don't fail the node).
21. Vision analysis: if 0 products pass niche-match filter → node raises error → status=failed; message: "No matching products found for this keyword."

## LangGraph Architecture

```
django-rq worker
  └── run_niche_research_graph(research_id, niche_keyword, marketplace)
        └── LangGraph StateGraph (thread_id = research_id)
              │   PostgreSQL checkpointer (durable state per node)
              ├── [START]
              ├── Node: scrape
              │     ├── call scrape_search_page_job(keyword, marketplace)
              │     ├── poll ProductSearchCache.status until completed
              │     └── write product_asins to state
              ├── Node: vision_analyze
              │     ├── Send API fan-out: one sub-invocation per ASIN (parallel)
              │     │     Each: vision LLM (OPENROUTER_VISION_MODEL) → VisionAnalysisSchema
              │     │     Niche-match filter: is_niche_match=true only
              │     ├── Fan-in: collect all per-product vision results
              │     ├── INSERT NicheProductVisionAnalysis (one row per product)
              │     └── write vision_analyses to state
              ├── Node: analyze
              │     ├── LLM Agent with SearXNG tool (SEARXNG_BASE_URL)
              │     │     ≥3 searches: niche culture, Reddit context, lifestyle terms
              │     ├── llm.with_structured_output(NicheAnalysisSchema)
              │     │     Evaluates all 16 patterns (present/absent + context)
              │     └── INSERT NicheAnalysis
              ├── Node: keywords
              │     ├── llm.with_structured_output(NicheKeywordSchema)
              │     │     (seeded with SearchKeywordResult top keywords)
              │     └── INSERT NicheKeywordAnalysis
              ├── Node: finalize
              │     ├── NicheResearch.status = completed
              │     └── Niche.status = deep_research
              └── [END]
```

**State TypedDict fields:**
- `research_id`: UUID
- `niche_name`: str
- `marketplace`: str
- `product_asins`: list[str] — written by scrape node
- `vision_analyses`: list[dict] — written by vision_analyze node (per-product results)
- `analysis_result`: dict — written by analyze node
- `keywords_result`: dict — written by keywords node
- `error`: str | None

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/niches/{id}/research/` | Member | Trigger research workflow |
| GET | `/api/niches/{id}/research/latest/` | Member | Poll latest research + results |
| GET | `/api/niches/{id}/research/` | Member | List all research runs |

## API Response Shape

`GET /api/niches/{id}/research/latest/` returns:
```json
{
  "id": "uuid",
  "status": "completed",
  "created_at": "...",
  "completed_at": "...",
  "analysis": {
    "niche_summary": "...",
    "sentiment": "positive",
    "primary_emotions": ["..."],
    "emotional_archetype": ["..."],
    "example_keywords": ["..."],
    "pattern_analysis": [{"name": "IDENTITY_DECLARATION", "present": true, "context": "..."}],
    "emotional_reality": "...",
    "design_concepts": "...",
    "dominant_design_aesthetics": "..."
  },
  "keywords": {
    "main_short_tail": ["..."],
    "main_long_tail": ["..."],
    "all_keywords_flat": "...",
    "top_focus_keywords": ["..."],
    "top_long_tail_keywords": ["..."]
  },
  "products": [
    {
      "asin": "...",
      "title": "...",
      "brand": "...",
      "url": "...",
      "rating": 4.8,
      "reviews_count": 124,
      "thumbnail_url": "...",
      "vision_analysis": {
        "slogan_text": "...",
        "meaning_context": "...",
        "visual_style": "...",
        "graphic_elements": "...",
        "layout_composition": "..."
      }
    }
  ],
  "related_niches": [
    {"id": "uuid", "name": "...", "shared_patterns": ["IDENTITY_DECLARATION", "TRIBE_COMMUNITY"]}
  ]
}
```

## Models

### NicheResearch
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| niche | ForeignKey(Niche) | |
| status | CharField choices [pending, running, completed, failed] | |
| triggered_by | ForeignKey(User) | |
| created_at | DateTimeField | auto_now_add |
| completed_at | DateTimeField(nullable) | |
| error_message | TextField | blank=True |

### NicheProductVisionAnalysis
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | db_index=True |
| product | ForeignKey(AmazonProduct) | |
| slogan_text | TextField | blank=True |
| meaning_context | TextField | blank=True |
| visual_style | TextField | blank=True |
| graphic_elements | TextField | blank=True |
| layout_composition | TextField | blank=True |
| is_niche_match | BooleanField | |
| created_at | DateTimeField | auto_now_add |

### NicheAnalysis
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | |
| niche | ForeignKey(Niche) | |
| niche_summary | TextField | |
| sentiment | CharField(50) | enum: positive/neutral/negative |
| primary_emotions | JSONField | list[str] |
| emotional_archetype | JSONField | list[str] |
| example_keywords | JSONField | list[str] |
| pattern_analysis | JSONField | list[{name, present, context}] — all 16 |
| emotional_reality | TextField | |
| design_concepts | TextField | |
| dominant_design_aesthetics | TextField | |
| created_at | DateTimeField | |

### NicheKeywordAnalysis
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | |
| niche | ForeignKey(Niche) | |
| main_short_tail | JSONField | list[str] |
| main_long_tail | JSONField | list[str] |
| all_keywords_flat | TextField | |
| top_focus_keywords | JSONField | list[str] |
| top_long_tail_keywords | JSONField | list[str] |
| created_at | DateTimeField | |

### NicheResearchProduct
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | db_index=True |
| product | ForeignKey(AmazonProduct) | links to PROJ-16 model |

> Full product data lives in `AmazonProduct` (PROJ-16). `NicheResearchProduct` is a through-table linking a research run to the specific products analyzed.

## Edge Cases

1. Research triggered while previous run still pending/running → 409 "Research already in progress."
2. Scrape returns 0 products → vision_analyze node aborts; status=failed; message: "No products found for this keyword."
3. Vision analysis: 0 products pass niche-match filter → analyze node aborts; status=failed; message: "No matching products found for this keyword."
4. Vision analysis: thumbnail URL unreachable → skip product (log warning), continue with remaining products.
5. LLM returns malformed JSON (structured output parse error) → node retried up to 2 times; if still failing, status=failed with error detail.
6. PostgreSQL checkpointer connection lost → job fails; on retry, LangGraph resumes from last checkpoint.
7. Niche does not exist or belongs to different workspace → 404 / 403 before job is enqueued.
8. Research timeout (>15 min) → watchdog job (every 5 min) sets status=failed; "Research timed out" message shown.
9. No other niches have ≥2 shared active patterns → `related_niches: []`.
10. LLM provider unavailable (API error) → node retried with backoff; after 2 retries, status=failed.
11. SearXNG unavailable → analyze node retried; if still failing, LLM agent proceeds with product data only (no web enrichment) — or fails depending on retry budget.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope, worker service)
- PROJ-5 (Niche List — niche FK; status update to `deep_research`)
- PROJ-16 (Amazon Product Scraper — `scrape_search_page_job` called internally; `AmazonSearchPageSpider`; `AmazonProduct` model; `SearchKeywordResult` for keyword seeding)
- SearXNG instance in localai-stack (must be reachable via `SEARXNG_BASE_URL`)

## Environment Variables Required

```
OPENROUTER_API_KEY=              # OpenRouter API key (OpenAI-compatible endpoint)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MODEL=                # e.g. openai/gpt-4.1-mini — for analyze + keywords nodes
OPENROUTER_VISION_MODEL=         # e.g. openai/gpt-4.1-mini — for vision_analyze node (must support vision)
SEARXNG_BASE_URL=                # e.g. http://searxng:8080 — SearXNG in localai-stack
LANGCHAIN_TRACING_V2=true        # Optional: LangSmith tracing
LANGCHAIN_API_KEY=               # Optional: LangSmith API key
LANGCHAIN_PROJECT=merch-miner-niche-research
```

> **Note:** The OpenRouter API key in the existing n8n workflow JSON files must be rotated before PROJ-6 goes to production.

## Python Dependencies to Add

```
langchain-core
langchain-openai          # OpenRouter uses OpenAI-compatible API
langchain-community       # SearXNG tool
langgraph
langgraph-checkpoint-postgres
```
