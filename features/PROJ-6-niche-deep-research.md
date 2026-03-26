# PROJ-6: Niche Deep Research (LangGraph)

**Status:** Ready to Deploy
**Priority:** P0 (MVP)
**Created:** 2026-02-27
**Updated:** 2026-03-21

## Overview

Trigger an AI research workflow for a given niche. A **LangGraph StateGraph** orchestrates the pipeline: (1) scrape Amazon products via PROJ-16 Scrapy engine, (2) analyze each product thumbnail via vision LLM (slogan extraction), (3) run deep emotional/psychological analysis per product slogan, (4) aggregate all per-product analyses into a niche identity profile using an LLM agent with SearXNG web search, (5) generate keyword recommendations. The workflow runs as a **django-rq background job** with a **PostgreSQL checkpointer** for fault tolerance and resume-on-failure. Migrates the existing n8n niche analyser workflow (in `/n8n-workflow/nichen-analyses/`) to LangGraph. No n8n dependency.

### Why LangGraph

- **StateGraph** — explicit node transitions, easy to reason about and extend
- **PostgreSQL checkpointer** — durable state snapshots; failed runs resume from last successful node
- **Structured output** — Pydantic `BaseModel` + `llm.with_structured_output()` for reliable JSON from LLM
- **Thread-based execution** — each research run is its own thread (`thread_id = research_id`)
- **Async graph execution** — fully async nodes with `await asyncio.gather()` for parallel per-product LLM calls
- **Prebuilt agents** — `create_react_agent()` for tool-using agent nodes (SearXNG web search)

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

4. **Node `vision_analyze`**: Runs all products in parallel via `asyncio.gather`. Each product: vision LLM (`OPENROUTER_VISION_MODEL`) receives thumbnail URL + title/brand context. Extracts: `slogan_text`, `meaning_context`, `visual_style`, `graphic_elements`, `layout_composition`, `is_niche_match`. **Post-filter**: removes products where `is_niche_match=false`, slogan is empty, or slogan ≤2 words (exception: contains "Squad"/"Crew"). Saves results to `NicheProductVisionAnalysis` table. Writes filtered vision results to state.

5. **Node `emotional_analyze`**: Runs all filtered products in parallel via `asyncio.gather`. Each product: text LLM (`OPENROUTER_MODEL`) receives the vision analysis (slogan_text, meaning_context, visual_style, graphic_elements, layout_composition) and performs the "Slogan Emotional Analysis & Customer Psychology System" prompt. Produces per-product: `customer_psychology`, `sentiment_analysis`, `emotional_pattern` (one of 16), `vibe`, `semantic_structure`, `key_elements`, `tone`, `adaptation_formula`, `adaptation_examples`, `transferability_notes`. Saves results to `NicheProductEmotionalAnalysis` table. Writes all emotional analyses aggregated to state.

6. **Node `niche_profile`**: LLM Agent (`OPENROUTER_MODEL`) with **SearXNG web search tool** (via `SEARXNG_BASE_URL`). Agent receives all per-product emotional analyses aggregated. Mandatorily calls SearXNG ≥3 times: (1) "[niche] culture slang frustrations memes", (2) "day in the life of a [niche] reddit", (3) "[niche] lifestyle terminology" or "[niche] stereotypes vs reality". If SearXNG unavailable → agent continues without web enrichment. Evaluates all 16 predefined emotional patterns with evidence-based context (citing specific slogans). Determines 1–2 archetypes. Calls `llm.with_structured_output(NicheAnalysisSchema)`. Saves result to `NicheAnalysis` table.

7. **Node `keywords`**: Calls LLM via `llm.with_structured_output(NicheKeywordSchema)` with product titles + analysis context + `SearchKeywordResult.top_focus_keywords` + `top_long_tail_keywords` as seed data. Saves result to `NicheKeywordAnalysis` table.

8. **Node `finalize`**: Sets `NicheResearch.status = completed`, `completed_at = now()`. Updates niche `status = deep_research`.

9. Each node writes its output to the LangGraph state. The PostgreSQL checkpointer snapshots state after each node — if the job crashes, it resumes from the last successful node.

### The 16 Emotional Patterns (Predefined Enum)

These are hardcoded in the LLM system prompts as a fixed list:

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

10. `VisionAnalysisSchema` (per product): `slogan_text` (str), `meaning_context` (str), `visual_style` (str), `graphic_elements` (str), `layout_composition` (str), `is_niche_match` (bool).

11. `SloganEmotionalAnalysisSchema` (per product): `original_slogan` (str), `customer_psychology` ({buyer_profile, emotional_need, internal_monologue, what_they_cant_say_out_loud}), `sentiment_analysis` ({sentiment, primary_emotion, emotion_target, confrontation_level, workplace_culture_required, humor_style, humor_function}), `emotional_pattern` (str — "N: PATTERN_NAME"), `vibe` ({energy_level, attitude, core_emotion}), `semantic_structure` ({structural_template, wordplay_type, delivery_style}), `key_elements` (list[str]), `tone` (str), `adaptation_formula` (str), `adaptation_examples` (list[str]), `transferability_notes` ({works_best_in: list[str], avoid_in: list[str], critical_success_factors: list[str]}).

12. `NicheAnalysisSchema`: `niche_summary` (str), `sentiment` (str enum: Positive/Neutral/Negative), `primary_emotions` (list[str], 3–5 items), `emotional_archetype` (list[str], 1–2 items), `example_keywords` (list[str], 5–7 items), `pattern_analysis` (list[PatternItem] — all 16 patterns, where `PatternItem = {name: PatternEnum, present: bool, context: str}`), `emotional_reality` (str, single line — what customers are truly buying emotionally), `design_concepts` (str, single line — dominant themes + target audience + positioning), `dominant_design_aesthetics` (str, single line — colors, fonts, vectors, layouts).

13. `NicheKeywordSchema`: `main_short_tail` (list[str]), `main_long_tail` (list[str]), `all_keywords_flat` (str), `top_focus_keywords` (list[str]), `top_long_tail_keywords` (list[str]).

### Polling & Display
14. Frontend polls `GET /api/niches/{id}/research/latest/` every 5 seconds while status is pending or running. Frontend stops polling after **20 minutes** and shows an error state.
15. MUI LinearProgress shown while polling. When complete: summary card + pattern cards + keyword chips + related niches section replace the progress bar.
16. Active patterns (`present=true`) shown prominently as highlighted cards with `context` text. Inactive patterns (`present=false`) shown collapsed/grayed.
17. `related_niches` computed server-side at read time: up to 5 other niches in the same workspace where `NicheAnalysis.pattern_analysis` contains ≥2 matching active patterns. Each entry: `{id, name, shared_patterns: ["PATTERN_NAME", ...]}`.

### Error Handling
18. Node-level failure → LangGraph retries the node up to 2 times before propagating error.
19. After all retries exhausted → `NicheResearch.status = failed`, `error_message` populated with node name + exception detail.
20. Frontend shows retry button that triggers a new `POST /api/niches/{id}/research/`.
21. Research timeout (workflow running > 15 min with no node completion) → background watchdog job (django-rq scheduled, runs every 5 min) sets status=failed.
22. Vision analysis: if thumbnail URL unreachable → skip that product, continue with remaining.
23. Vision analysis: if 0 products pass filter → status=failed; message: "No matching products found for this keyword."
24. SearXNG unavailable → niche_profile node continues without web enrichment (no failure).

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
              │     ├── asyncio.gather: parallel vision LLM per product
              │     │     Each: OPENROUTER_VISION_MODEL → VisionAnalysisSchema
              │     ├── Filter: niche_match + slogan exists + slogan length
              │     ├── INSERT NicheProductVisionAnalysis (one row per product)
              │     └── write filtered vision_analyses to state
              ├── Node: emotional_analyze
              │     ├── asyncio.gather: parallel emotional LLM per filtered product
              │     │     Each: OPENROUTER_MODEL → SloganEmotionalAnalysisSchema
              │     ├── INSERT NicheProductEmotionalAnalysis (one row per product)
              │     └── write emotional_analyses to state
              ├── Node: niche_profile
              │     ├── LLM Agent with SearXNG tool (SEARXNG_BASE_URL)
              │     │     ≥3 searches: culture/slang, Reddit context, lifestyle terms
              │     │     SearXNG unavailable → continue without web enrichment
              │     ├── llm.with_structured_output(NicheAnalysisSchema)
              │     │     Evaluates all 16 patterns (evidence-based context)
              │     │     Determines 1-2 archetypes
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
- `vision_analyses`: list[dict] — written by vision_analyze node (filtered results only)
- `emotional_analyses`: list[dict] — written by emotional_analyze node (per-product)
- `analysis_result`: dict — written by niche_profile node
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
    "sentiment": "Positive",
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
      },
      "emotional_analysis": {
        "customer_psychology": {"buyer_profile": "...", "emotional_need": "...", "internal_monologue": "...", "what_they_cant_say_out_loud": "..."},
        "sentiment_analysis": {"sentiment": "...", "primary_emotion": "...", "emotion_target": "...", "confrontation_level": "...", "workplace_culture_required": "...", "humor_style": "...", "humor_function": "..."},
        "emotional_pattern": "1: IDENTITY_DECLARATION",
        "vibe": {"energy_level": "...", "attitude": "...", "core_emotion": "..."},
        "semantic_structure": {"structural_template": "...", "wordplay_type": "...", "delivery_style": "..."},
        "key_elements": ["..."],
        "tone": "...",
        "adaptation_formula": "...",
        "adaptation_examples": ["..."],
        "transferability_notes": {"works_best_in": ["..."], "avoid_in": ["..."], "critical_success_factors": ["..."]}
      }
    }
  ],
  "related_niches": [
    {"id": "uuid", "name": "...", "shared_patterns": ["IDENTITY_DECLARATION", "TRIBE_COMMUNITY"]}
  ]
}
```

## Models

### ResearchNodeConfig
| Field | Type | Notes |
|-------|------|-------|
| id | AutoField | PK |
| node_name | CharField(50), unique | choices: vision_analyze, emotional_analyze, niche_profile, keywords |
| model_name | CharField(100) | e.g. "openai/gpt-4.1-mini" — OpenRouter model identifier |
| temperature | FloatField | default 0.3 |
| max_tokens | IntegerField(nullable) | optional LLM output limit |
| system_prompt | TextField | editable in Django Admin, no redeploy needed |
| updated_at | DateTimeField | auto_now |

> 4 rows total — one per LLM node. Editable in Django Admin without redeploy. Each node reads its config at runtime. Fallback to code defaults if no DB record exists. LLM model + prompt + temperature switchable per node at any time.

### NicheResearch
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| niche | ForeignKey(Niche) | |
| status | CharField choices [pending, running, completed, failed] | |
| triggered_by | ForeignKey(User) | |
| config_snapshot | JSONField | snapshot of all ResearchNodeConfig at run start (audit trail) |
| created_at | DateTimeField | auto_now_add |
| completed_at | DateTimeField(nullable) | |
| error_message | TextField | blank=True |

### NicheResearchProduct
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | db_index=True |
| product | ForeignKey(AmazonProduct) | links to PROJ-16 model |

> Full product data lives in `AmazonProduct` (PROJ-16). Through-table linking research run to analyzed products.

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

### NicheProductEmotionalAnalysis
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | db_index=True |
| product | ForeignKey(AmazonProduct) | |
| original_slogan | TextField | |
| customer_psychology | JSONField | {buyer_profile, emotional_need, internal_monologue, what_they_cant_say_out_loud} |
| sentiment_analysis | JSONField | {sentiment, primary_emotion, emotion_target, confrontation_level, workplace_culture_required, humor_style, humor_function} |
| emotional_pattern | CharField(100) | "N: PATTERN_NAME" |
| vibe | JSONField | {energy_level, attitude, core_emotion} |
| semantic_structure | JSONField | {structural_template, wordplay_type, delivery_style} |
| key_elements | JSONField | list[str] |
| tone | TextField | |
| adaptation_formula | TextField | |
| adaptation_examples | JSONField | list[str] |
| transferability_notes | JSONField | {works_best_in, avoid_in, critical_success_factors} |
| created_at | DateTimeField | auto_now_add |

### NicheAnalysis
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| research | ForeignKey(NicheResearch) | |
| niche | ForeignKey(Niche) | |
| niche_summary | TextField | |
| sentiment | CharField(50) | enum: Positive/Neutral/Negative |
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

## Edge Cases

1. Research triggered while previous run still pending/running → 409 "Research already in progress."
2. Scrape returns 0 products → vision_analyze node aborts; status=failed; message: "No products found for this keyword."
3. Vision analysis: 0 products pass filter (niche match + slogan check) → status=failed; message: "No matching products found for this keyword."
4. Vision analysis: thumbnail URL unreachable → skip product (log warning), continue with remaining.
5. LLM returns malformed JSON (structured output parse error) → node retried up to 2 times; if still failing, status=failed with error detail.
6. PostgreSQL checkpointer connection lost → job fails; on retry, LangGraph resumes from last checkpoint.
7. Niche does not exist or belongs to different workspace → 404 / 403 before job is enqueued.
8. Research timeout (>15 min) → watchdog job (every 5 min) sets status=failed; "Research timed out" message shown.
9. No other niches have ≥2 shared active patterns → `related_niches: []`.
10. LLM provider unavailable (API error) → node retried with backoff; after 2 retries, status=failed.
11. SearXNG unavailable → niche_profile node continues without web enrichment (no failure).

## Dependencies

- PROJ-4 (Workspace & Membership — workspace scope, worker service)
- PROJ-5 (Niche List — niche FK; status update to `deep_research`)
- PROJ-16 (Amazon Product Scraper — `scrape_search_page_job` called internally; `AmazonSearchPageSpider`; `AmazonProduct` model; `SearchKeywordResult` for keyword seeding)
- SearXNG instance in localai-stack (must be reachable via `SEARXNG_BASE_URL`)

## Amendments (PROJ-15/18/19 Harmonization)

### Vector DB Integration (PROJ-15)
- Research outputs are embeddable sources in PROJ-15:
  - `NicheAnalysis` → `niche_summary + emotional_reality + design_concepts + dominant_design_aesthetics`
  - `NicheProductVisionAnalysis` → `slogan_text + meaning_context + visual_style`
  - `NicheProductEmotionalAnalysis` → `original_slogan + tone + adaptation_formula`
  - `NicheKeywordAnalysis` → `all_keywords_flat`
- `post_save` signals on all 4 models enqueue embedding jobs.
- Agent and users can semantically search across all research data via PROJ-15.
- `related_niches` computation (≥2 shared patterns) could be enhanced with vector similarity as future improvement.

### Web Search Enhancement (PROJ-17)
- niche_profile node: replace direct SearXNG calls with Vane API calls (PROJ-17). Vane uses SearXNG internally but adds LLM-synthesized answers — better quality, same infrastructure.
- Vane's mandatory searches (culture/slang, Reddit context, lifestyle terms) replace the current 3 SearXNG tool calls.
- Fallback: if Vane unavailable → fall back to direct SearXNG (existing behavior). Graceful degradation.
- Dependency on PROJ-17: `VANE_API_URL` env var must be set. If not set → use SearXNG directly.

### Agent Integration (PROJ-18)
- Research Agent has tools: `trigger_deep_research`, `read_research_results`, `find_similar_niches`, `cancel_research`.
- Agent can trigger research autonomously (subject to permission level: default=Approve).
- Agent can cancel running research if it determines the niche is not viable or workflow changes direction.
- Agent reads completed research results to inform downstream workflow decisions.
- Agent permission defaults: `trigger_deep_research` = Approve, `cancel_research` = Notify, `read_research_results` = Auto.

## Environment Variables Required

```
OPENROUTER_API_KEY=              # OpenRouter API key (secret, stays in env)
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
SEARXNG_BASE_URL=                # e.g. http://searxng:8080 — SearXNG in localai-stack
LANGCHAIN_TRACING_V2=true        # Optional: LangSmith observability
LANGCHAIN_API_KEY=               # Optional: LangSmith API key (for tracing dashboard, NOT for LLM calls)
LANGCHAIN_PROJECT=merch-miner-niche-research
```

> **Model names, temperatures, and system prompts are NOT in env vars.** They are stored in the `ResearchNodeConfig` DB table and editable via Django Admin without redeploy. Only secrets (API keys) and infrastructure URLs stay in env.

> **Note:** The OpenRouter API key in the existing n8n workflow JSON files must be rotated before PROJ-6 goes to production.

## Python Dependencies to Add

```
langchain-core
langchain-openai          # OpenRouter uses OpenAI-compatible API
langchain-community       # SearXNG tool
langgraph
langgraph-checkpoint-postgres
```

## Reference: n8n Workflow Source

The existing n8n workflow being migrated is in `/n8n-workflow/nichen-analyses/`:
- `00003 - n8n Amazon Niche Analyser Prototyping.json` (main workflow)
- `00003 - Subworkflows-Amazon Niche Analyser Prototyping.json` (parallel subworkflows for vision + emotional analysis)

---

## Tech Design (Solution Architect)

### Component Structure

```
Backend (django-app/)
├── niche_research_app/               ← NEW Django app
│   ├── models.py                     # 7 models: ResearchNodeConfig,
│   │                                 #   NicheResearch, NicheResearchProduct,
│   │                                 #   NicheProductVisionAnalysis, NicheProductEmotionalAnalysis,
│   │                                 #   NicheAnalysis, NicheKeywordAnalysis
│   ├── api/
│   │   ├── views.py                  # 3 endpoints: trigger, poll latest, list runs
│   │   ├── serializers.py            # Nested response (research + analysis + products + related)
│   │   └── urls.py                   # /api/niches/{id}/research/...
│   ├── graph/                        ← LangGraph workflow package
│   │   ├── state.py                  # ResearchState TypedDict
│   │   ├── nodes/
│   │   │   ├── scrape.py             # Node 1: PROJ-16 integration + DB polling
│   │   │   ├── vision_analyze.py     # Node 2: parallel vision LLM (asyncio.gather)
│   │   │   ├── emotional_analyze.py  # Node 3: parallel emotional LLM (asyncio.gather)
│   │   │   ├── niche_profile.py      # Node 4: ReAct agent + SearXNG tool
│   │   │   └── keywords.py           # Node 5: keyword generation
│   │   ├── schemas.py                # Pydantic schemas for structured output
│   │   ├── prompts.py                # Default prompts (fallback if no DB config)
│   │   ├── tools.py                  # SearXNG tool wrapper
│   │   └── workflow.py               # StateGraph assembly + compile
│   ├── tasks.py                      # django-rq job: run_niche_research
│   ├── watchdog.py                   # Scheduled job: detect stuck runs
│   └── admin.py                      # Admin registration
│
├── niche_app/
│   └── models.py                     # Niche.research_status + research_run_id (existing)
│
└── scraper_app/                      # PROJ-16 (existing, called by scrape node)
    └── tasks.py                      # scrape_search_page_job (existing)

Frontend (frontend-ui/src/)
└── views/niches/research/
    ├── index.tsx                      # Research results page
    ├── hooks/
    │   └── useNicheResearch.ts        # Polling hook (5s interval, 20min timeout)
    ├── partials/
    │   ├── ResearchTriggerButton.tsx   # "AI Research" button + 409 handling
    │   ├── ResearchProgress.tsx        # LinearProgress during polling
    │   ├── NicheSummaryCard.tsx        # Summary, sentiment, archetypes
    │   ├── PatternCard.tsx             # Single pattern (active/inactive)
    │   ├── PatternGrid.tsx             # All 16 patterns grid
    │   ├── KeywordChips.tsx            # Keyword display
    │   ├── ProductAnalysisCard.tsx     # Single product with vision + emotional analysis
    │   └── RelatedNiches.tsx           # Related niches section
    └── services/
        └── researchApi.ts             # API calls (trigger, poll, list)
```

### Tech Decisions

**1. New Django App `niche_research_app` (not inside `niche_app`)**
The LangGraph workflow is complex (6 nodes, 6 models, prompts, tools, schemas). Putting this inside the existing `niche_app` would bloat it. Separate app = Single Responsibility. Models link back to `Niche` via ForeignKey.

**2. Fully async LangGraph graph + single asyncio.run() in django-rq task**
All graph nodes are defined as `async def`. The entire graph runs via `graph.ainvoke()`. django-rq is sync, so the task entry-point calls `asyncio.run(graph.ainvoke(...))` exactly once. This avoids nested `asyncio.run()` calls (which can cause issues) and lets `vision_analyze` / `emotional_analyze` nodes use `await asyncio.gather(...)` natively for parallel LLM calls.

**3. AsyncPostgresSaver — shares existing Supabase PostgreSQL**
LangGraph's `AsyncPostgresSaver.from_conn_string(DB_URI)` manages its own async connection pool. Required because the graph runs async via `ainvoke()`. Uses the same database as Django (Supabase PG in `merch_miner` schema). Checkpoints are durable — if the worker crashes, the graph resumes from the last completed node on the next run. Thread ID = research UUID.

**4. ChatOpenAI via OpenRouter — dynamic model per node**
Each LLM node reads its model name, temperature, and system prompt from the `ResearchNodeConfig` DB table at runtime. `ChatOpenAI(model=config.model_name, temperature=config.temperature, base_url=OPENROUTER_BASE_URL)`. Model + prompt + temperature switchable via Django Admin without redeploy. Only API key and base URL stay in env vars (secrets). Fallback to code defaults if no DB config exists.

**5. Structured output via Pydantic `with_structured_output()`**
Each LLM call produces typed output using `llm.with_structured_output(PydanticModel)`. LangChain sends the Pydantic schema as a JSON Schema to the LLM's structured output mode. This guarantees valid JSON matching the schema — no manual parsing or retry-on-malformed-JSON needed.

**5b. System prompts in DB, not in code**
System prompts are stored in the `ResearchNodeConfig.system_prompt` field (TextField). Editable via Django Admin. Default prompts (ported from n8n) are loaded as initial data via migration or management command. Each NicheResearch run stores a `config_snapshot` JSONField capturing the exact config used — full audit trail for prompt A/B testing.

**6. SearXNG tool via langchain-community**
`SearxSearchWrapper` wraps the existing SearXNG instance in the localai Docker stack. Configured via `SEARXNG_BASE_URL` env var. Wrapped as a LangChain `@tool` and bound to the LLM via `llm.bind_tools([searxng_tool])`. The niche_profile node runs a ReAct agent loop: LLM decides what to search → tool executes → LLM gets results → decides next action. If SearXNG is unreachable, the tool call is caught and the agent continues without web enrichment.

**7. `create_react_agent()` sub-graph for niche_profile node**
The niche_profile node uses LangGraph's built-in `langgraph.prebuilt.create_react_agent()` as a compiled sub-graph. This is the official LangGraph pattern for tool-using agents — handles the LLM → tool → LLM loop automatically with proper state management. The sub-graph is invoked within the niche_profile node function, keeping the main graph simple (6 linear nodes). After the agent completes its tool calls, a final `llm.with_structured_output(NicheAnalysisSchema)` call produces the structured result.

**8. RetryPolicy on LLM nodes**
LangGraph's built-in `RetryPolicy(max_attempts=3)` on vision_analyze, emotional_analyze, niche_profile, and keywords nodes. Handles transient LLM API errors (rate limits, timeouts, 500s). The scrape node has its own polling+timeout logic and doesn't need LangGraph retry.

**9. New RQ queue `research` with 20-min timeout**
Separate from `default` (15 min) and `scraper` (30 min). The research workflow is long-running but bounded. 20-minute timeout matches the frontend polling timeout. A new `worker-research` Docker service processes this queue.

**10. Watchdog via rq-scheduler (already installed)**
`rq-scheduler` is already in `requirements.txt` and has a `scheduler` Docker service. A scheduled job runs every 5 minutes, queries `NicheResearch.objects.filter(status='running', created_at__lt=now()-15min)`, and sets them to `failed` with timeout message.

**11. Niche model sync**
The existing `Niche` model already has `research_status` and `research_run_id` fields. The `finalize` node updates these in sync with `NicheResearch.status` for quick UI lookups without joining the research table.

**12. LLM input format: Structured Markdown (not JSON blobs)**
All data passed to LLM nodes as context (product data, emotional analyses) is formatted as structured Markdown — headers per product, key-value pairs, lists. Markdown is the state-of-the-art format for LLM input: models are heavily trained on it, it provides clear structure (headers, lists, tables), and is significantly more token-efficient than raw JSON (no brackets, quotes, escaping). This matches the proven n8n workflow approach.

**13. Parallel LLM concurrency limit: Semaphore(10)**
The `vision_analyze` and `emotional_analyze` nodes use `asyncio.Semaphore(10)` to limit concurrent LLM API calls to max 10 at a time. Prevents OpenRouter rate limit errors when processing large product sets (30+ products). Configurable via constant, not env var — rarely needs changing.

### Dependencies (packages to add to requirements.txt)

| Package | Purpose |
|---------|---------|
| `langchain-core` | Base abstractions (messages, tools, prompts) |
| `langchain-openai` | ChatOpenAI for OpenRouter API calls |
| `langchain-community` | SearxSearchWrapper for SearXNG |
| `langgraph` | StateGraph orchestration + RetryPolicy |
| `langgraph-checkpoint-postgres` | PostgresSaver for durable checkpoints |

### Infrastructure Changes

| Change | Where | Why |
|--------|-------|-----|
| New RQ queue `research` | `settings.py → RQ_QUEUES` | Isolated timeout (20 min) for research jobs |
| New Docker service `worker-research` | `docker-compose.yml` | Dedicated worker for research queue |
| 3 new env vars | `.env.template` | OPENROUTER_API_KEY, OPENROUTER_BASE_URL, SEARXNG_BASE_URL (model names + prompts in DB) |
| LangSmith env vars (optional) | `.env.template` | LANGCHAIN_TRACING_V2, LANGCHAIN_API_KEY, LANGCHAIN_PROJECT |
