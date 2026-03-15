# PROJ-6: Niche Deep Research (LangGraph)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-14

## Overview

Trigger an AI research workflow for a given niche. A **LangGraph StateGraph** orchestrates the pipeline: (1) scrape Amazon products for the niche keyword via PROJ-16 Scrapy engine, (2) analyze the results with an LLM to produce structured analysis (sentiment, emotional archetypes, design concepts, pattern analysis), (3) generate keyword recommendations. The workflow runs as a **django-rq background job** with a **PostgreSQL checkpointer** for fault tolerance and resume-on-failure. Django polls the DB for status — no HTTP callback needed. No n8n dependency.

### Why LangGraph

LangGraph is the production-grade standard for stateful, multi-step agent orchestration. Key production features used here:
- **StateGraph** — explicit node transitions, easy to reason about and extend
- **PostgreSQL checkpointer** — durable state snapshots; failed runs resume from last successful node
- **Structured output** — Pydantic `BaseModel` + `llm.with_structured_output()` for reliable JSON from LLM
- **Thread-based execution** — each research run is its own thread (`thread_id = research_id`)

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
1. `POST /api/niches/{id}/research/` — creates `NicheResearch` (status=pending) → enqueues LangGraph workflow job via django-rq → returns research record. Returns 409 if a pending/running research already exists for this niche.
2. The django-rq job runs the LangGraph StateGraph synchronously in the worker process.

### LangGraph Workflow Nodes
3. **Node `scrape`**: Calls PROJ-16 `scrape_keyword_job` (synchronous within worker) with the niche keyword + marketplace. Updates `NicheResearch.status = running`. Waits for `ProductSearchCache.status = completed` by polling DB (max 10 min, 5s interval). On timeout → raise error → node retry.
4. **Node `analyze`**: Fetches scraped `AmazonProduct` rows for the keyword. Calls LLM via `llm.with_structured_output(NicheAnalysisSchema)` with product data. Saves result to `NicheAnalysis` table.
5. **Node `keywords`**: Calls LLM via `llm.with_structured_output(NicheKeywordSchema)` with product titles + analysis context. Saves result to `NicheKeywordAnalysis` table.
6. **Node `finalize`**: Sets `NicheResearch.status = completed`, `completed_at = now()`. Updates niche `status = deep_research`.
7. Each node writes its output to the LangGraph state. The PostgreSQL checkpointer snapshots state after each node — if the job crashes, it resumes from the last successful node.

### Structured Output Schemas (Pydantic)
8. `NicheAnalysisSchema`: `niche_summary` (str), `sentiment` (str), `primary_emotions` (list[str]), `emotional_archetype` (list[str]), `example_keywords` (list[str]), `pattern_analysis` (list[PatternItem] where `PatternItem = {name: str, present: bool, context: str}`), `emotional_reality` (str), `design_concepts` (str), `dominant_design_aesthetics` (str).
9. `NicheKeywordSchema`: `main_short_tail` (list[str]), `main_long_tail` (list[str]), `all_keywords_flat` (str), `top_focus_keywords` (list[str]), `top_long_tail_keywords` (list[str]).

### Polling & Display
10. Frontend polls `GET /api/niches/{id}/research/latest/` every 5 seconds while status is pending or running.
11. MUI LinearProgress shown while polling. When complete: summary card + pattern cards + keyword chips + related niches section replace the progress bar.
12. Active patterns (`present=true`) shown prominently as highlighted cards with `context` text. Inactive patterns (`present=false`) shown collapsed/grayed.
13. `related_niches` computed server-side at read time: up to 5 other niches in the same workspace where `NicheAnalysis.pattern_analysis` contains ≥2 matching active patterns. Each entry: `{id, name, shared_patterns: ["PATTERN_NAME", ...]}`.

### Error Handling
14. Node-level failure → LangGraph retries the node up to 2 times before propagating error.
15. After all retries exhausted → `NicheResearch.status = failed`, `error_message` populated with node name + exception detail.
16. Frontend shows retry button that triggers a new `POST /api/niches/{id}/research/`.
17. Research timeout (workflow running > 15 min with no node completion) → background watchdog job sets status=failed.

## LangGraph Architecture

```
django-rq worker
  └── run_niche_research_graph(research_id, niche_keyword, marketplace)
        └── LangGraph StateGraph (thread_id = research_id)
              │   PostgreSQL checkpointer (durable state per node)
              ├── [START]
              ├── Node: scrape
              │     ├── call scrape_keyword_job(keyword, marketplace)
              │     ├── poll ProductSearchCache.status until completed
              │     └── write products to state
              ├── Node: analyze
              │     ├── load AmazonProducts from DB
              │     ├── llm.with_structured_output(NicheAnalysisSchema)
              │     └── INSERT NicheAnalysis
              ├── Node: keywords
              │     ├── llm.with_structured_output(NicheKeywordSchema)
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
    "sentiment": "...",
    "primary_emotions": ["..."],
    "emotional_archetype": ["..."],
    "example_keywords": ["..."],
    "pattern_analysis": [{"name": "...", "present": true, "context": "..."}],
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
    {"asin": "...", "title": "...", "brand": "...", "url": "...", "rating": 4.8, "reviews_count": 124, "thumbnail_url": "..."}
  ],
  "related_niches": [
    {"id": "uuid", "name": "...", "shared_patterns": ["PATTERN_A", "PATTERN_B"]}
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

### NicheAnalysis
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | |
| niche | ForeignKey(Niche) | |
| niche_summary | TextField | |
| sentiment | CharField(50) | |
| primary_emotions | JSONField | list[str] |
| emotional_archetype | JSONField | list[str] |
| example_keywords | JSONField | list[str] |
| pattern_analysis | JSONField | list[{name, present, context}] |
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

> Note: Full product data lives in `AmazonProduct` (PROJ-16). `NicheResearchProduct` is a through-table linking a research run to the specific products analyzed.

## Edge Cases

1. Research triggered while previous run still pending/running → 409 "Research already in progress."
2. Scrape returns 0 products (new keyword, no data yet) → analyze node aborts; status=failed; message: "No products found for this keyword."
3. LLM returns malformed JSON (structured output parse error) → node retried up to 2 times; if still failing, status=failed with error detail.
4. PostgreSQL checkpointer connection lost → job fails; on retry, LangGraph resumes from last checkpoint (scrape result preserved; LLM calls not repeated).
5. Niche does not exist or belongs to different workspace → 404 / 403 before job is enqueued.
6. Research timeout (>15 min) → watchdog sets status=failed; "Research timed out" message shown.
7. No other niches have ≥2 shared active patterns → `related_niches: []`.
8. LLM provider unavailable (API error) → node retried with backoff; after 2 retries, status=failed.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope, worker service)
- PROJ-5 (Niche List — niche FK; status update to `deep_research`)
- PROJ-16 (Amazon Product Scraper — `scrape_keyword_job` called internally; `AmazonProduct` model)

## Environment Variables Required

```
OPENROUTER_API_KEY=       # OpenRouter API key (OpenAI-compatible endpoint)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
LANGCHAIN_TRACING_V2=true # Optional: LangSmith tracing for production observability
LANGCHAIN_API_KEY=        # Optional: LangSmith API key
LANGCHAIN_PROJECT=merch-miner-niche-research
```

## Python Dependencies to Add

```
langchain-core
langchain-openai        # OpenRouter uses OpenAI-compatible API
langgraph
langgraph-checkpoint-postgres
```
