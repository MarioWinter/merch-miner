# PROJ-15: Vector Database (AI Memory)

**Status:** Planned
**Priority:** P0 (MVP)
**Created:** 2026-03-24

## Overview

pgvector-based persistent knowledge store for all AI-generated and user-created data in Merch Miner. Foundation layer for the Agent system (PROJ-18) and Deep Web Search (PROJ-17). Stores embeddings for semantic similarity search across niches, slogans, keywords, research outputs, chat histories, web search results, listings, and Amazon products.

Uses the existing Supabase PostgreSQL instance with the `pgvector` extension — no additional services. A central `Embedding` table with `GenericForeignKey` stores all embeddings. Hybrid search combines vector cosine similarity with PostgreSQL full-text search (`tsvector`) for both semantic and exact-match queries.

Embeddings are created asynchronously via django-rq jobs triggered by `post_save` signals on source models. Embedding model: OpenAI `text-embedding-3-small` (1536 dimensions) via OpenRouter.

## User Stories

1. As a member, I want to find semantically similar niches, so I can discover related opportunities I wouldn't find with keyword search alone.
2. As a member, I want to search across all my workspace data (slogans, research, keywords, products) with a single query, so I get a holistic view of relevant information.
3. As a member, I want exact matches on ASINs, brand names, and specific keywords to appear alongside semantic results, so I don't miss obvious hits.
4. As the Agent (PROJ-18), I need to retrieve relevant context from past research, slogans, and chat history across sessions, so I can make informed decisions without re-researching.
5. As the Web Search system (PROJ-17), I need to store crawled web content as embeddings, so results are searchable and reusable later.
6. As a member, I want my workspace data isolated from other workspaces, so my research and strategies stay private.

## Acceptance Criteria

### pgvector Setup

- [ ] AC-1: `pgvector` extension enabled in Supabase PostgreSQL (`CREATE EXTENSION IF NOT EXISTS vector`). Managed via Django migration.
- [ ] AC-2: `pg_trgm` extension enabled for full-text search support. Managed via Django migration.

### Embedding Model

- [ ] AC-3: Central `Embedding` model with fields: `id` (UUID pk), `content_type` (FK to Django ContentType), `object_id` (UUID), `workspace` (FK to Workspace, on_delete=CASCADE, db_index=True), `embedding` (VectorField, dimensions=1536), `text_input` (TextField — the text that was embedded), `metadata` (JSONField, default=dict — flexible: source, niche_id, content_subtype etc.), `search_text` (TextField — optimized for tsvector full-text search), `search_vector` (SearchVectorField — auto-updated GIN-indexed tsvector), `created_at`, `updated_at`.
- [ ] AC-4: HNSW index on `embedding` column for fast approximate nearest neighbor search. `CREATE INDEX ON embedding USING hnsw (embedding vector_cosine_ops)`.
- [ ] AC-5: GIN index on `search_vector` column for full-text search.
- [ ] AC-6: Composite index on `(workspace_id, content_type_id)` for filtered queries.
- [ ] AC-7: `unique_together = [('content_type', 'object_id')]` — one embedding per source object. Updates overwrite.

### Embedding Service (Internal)

- [ ] AC-8: `EmbeddingService` class in `vector_app/services.py` with methods: `create_embedding(instance)`, `search(query, workspace_id, content_types=None, top_k=10, threshold=0.3, strategy='similarity')`, `delete_embedding(instance)`.
- [ ] AC-9: `create_embedding()` calls OpenRouter with model `text-embedding-3-small`, stores result in `Embedding` table. Populates `text_input` from source object fields, `search_text` from same text (for tsvector), `metadata` with source context (niche_id, source type etc.).
- [ ] AC-10: `search()` performs hybrid query: vector cosine similarity + tsvector full-text match. Combined score: `0.7 * vector_score + 0.3 * text_score`. Always filtered by `workspace_id`. Optional `content_types` filter. Returns list of `{object, score, content_type, metadata}`.
- [ ] AC-11: `search()` supports `strategy` parameter: `similarity` (default — cosine distance) or `mmr` (Max Marginal Relevance, lambda=0.7, fetch top_k*2 candidates then diversify to top_k).
- [ ] AC-12: `search()` supports optional `top_k` (default 10) and `threshold` (default 0.3) override parameters.

### Text Extraction (per content_type)

- [ ] AC-13: Each embeddable model has a `get_embedding_text()` method that returns the text to embed. Mapping:

| Source Model | Embedded Text | content_type key |
|---|---|---|
| `Niche` | `name + " " + notes` | `niche` |
| `NicheAnalysis` | `niche_summary + " " + emotional_reality + " " + design_concepts + " " + dominant_design_aesthetics` | `niche_analysis` |
| `NicheProductVisionAnalysis` | `slogan_text + " " + meaning_context + " " + visual_style` | `vision_analysis` |
| `NicheProductEmotionalAnalysis` | `original_slogan + " " + tone + " " + adaptation_formula` | `emotional_analysis` |
| `NicheKeywordAnalysis` | `all_keywords_flat` | `keyword_analysis` |
| `Idea` | `slogan_text + " " + why_it_works` | `idea` |
| `Listing` | `title + " " + bullet_1..5 + " " + description` | `listing` |
| `AmazonProduct` | `title + " " + brand + " " + bullets` | `amazon_product` |
| `ChatMessage` (PROJ-17/19) | `content` | `chat_message` |
| `WebSearchResult` (PROJ-17) | chunked `content` (1500 tokens, 5% overlap) | `web_search` |

### Async Embedding Pipeline

- [ ] AC-14: Django `post_save` signals on all embeddable models enqueue a `create_or_update_embedding` django-rq job on the `default` queue.
- [ ] AC-15: `post_delete` signal on all embeddable models enqueue a `delete_embedding` django-rq job.
- [ ] AC-16: Embedding job is idempotent — if embedding already exists for (content_type, object_id), it overwrites the embedding + text_input + search_text + metadata.
- [ ] AC-17: Embedding job failure (OpenRouter down, rate limit) retries up to 3 times with exponential backoff (10s, 30s, 90s). After 3 failures, logs error, does not block source object.
- [ ] AC-18: WebSearchResult objects are chunked before embedding: 1500 tokens per chunk, 5% overlap. Each chunk creates a separate Embedding row with `metadata.chunk_index` and `metadata.parent_id`.

### API — Generic Semantic Search

- [ ] AC-19: `POST /api/search/semantic/` — body: `{"query": "text", "content_types": ["idea", "niche_analysis"], "top_k": 10, "threshold": 0.3, "strategy": "similarity"}`. All fields except `query` are optional (defaults applied). Returns list of results with score, content_type, object summary, and metadata. Workspace-scoped (from auth).
- [ ] AC-20: Response shape:
```json
{
  "results": [
    {
      "score": 0.87,
      "content_type": "idea",
      "object_id": "uuid",
      "text_preview": "first 200 chars of text_input",
      "metadata": {"niche_id": "uuid", "niche_name": "Camping Dad"}
    }
  ],
  "total": 8,
  "query": "original query text",
  "strategy": "similarity"
}
```

### API — Feature-Specific Convenience Endpoints

- [ ] AC-21: `GET /api/niches/{id}/similar/` — returns top 10 semantically similar niches in the workspace. Uses NicheAnalysis embedding if available, falls back to Niche name+notes embedding.
- [ ] AC-22: `GET /api/ideas/{id}/similar/` — returns top 10 similar ideas (slogans) across all niches in the workspace.
- [ ] AC-23: `GET /api/niches/{id}/related-content/` — returns mixed results (ideas, products, keywords, research) related to this niche's embedding. Cross-content_type search.

### Workspace Isolation

- [ ] AC-24: Every `Embedding` row has a `workspace_id` FK. Set automatically from the source object's workspace context.
- [ ] AC-25: `EmbeddingService.search()` ALWAYS filters by `workspace_id`. No cross-workspace queries possible.
- [ ] AC-26: Deleting a workspace cascades to all its embeddings.

### Management Command

- [ ] AC-27: `python manage.py backfill_embeddings` — processes all existing objects that don't have an embedding yet. Supports `--content-type=idea` filter and `--batch-size=100` option. Uses django-rq to enqueue jobs (not blocking).
- [ ] AC-28: `python manage.py embedding_stats` — prints count of embeddings per content_type and workspace, plus count of source objects missing embeddings.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/search/semantic/` | Member | Generic semantic search across all content types |
| GET | `/api/niches/{id}/similar/` | Member | Similar niches |
| GET | `/api/ideas/{id}/similar/` | Member | Similar ideas/slogans |
| GET | `/api/niches/{id}/related-content/` | Member | Mixed related content for a niche |

## Django App Structure

New Django app: `vector_app`

```
vector_app/
├── models.py          — Embedding model (VectorField, SearchVectorField)
├── services.py        — EmbeddingService (create, search, delete)
├── signals.py         — post_save / post_delete handlers for all embeddable models
├── tasks.py           — django-rq jobs (create_or_update_embedding, delete_embedding, backfill)
├── api/
│   ├── views.py       — SemanticSearchView, NicheSimilarView, IdeaSimilarView, RelatedContentView
│   ├── serializers.py — SearchRequestSerializer, SearchResultSerializer
│   └── urls.py
├── management/
│   └── commands/
│       ├── backfill_embeddings.py
│       └── embedding_stats.py
├── chunking.py        — WebSearchResult chunking logic (1500 tokens, 5% overlap)
└── admin.py           — Embedding admin (read-only, stats display)
```

## Hybrid Search Query (Conceptual)

```sql
-- Pseudo-query: vector + full-text combined scoring
SELECT e.*,
  (1 - (e.embedding <=> query_vector)) AS vector_score,
  ts_rank(e.search_vector, plainto_tsquery('english', query_text)) AS text_score,
  0.7 * (1 - (e.embedding <=> query_vector)) + 0.3 * ts_rank(e.search_vector, plainto_tsquery('english', query_text)) AS combined_score
FROM embedding e
WHERE e.workspace_id = :workspace_id
  AND (1 - (e.embedding <=> query_vector)) >= :threshold
ORDER BY combined_score DESC
LIMIT :top_k;
```

## Edge Cases

- [ ] EC-1: Source object saved but OpenRouter is down → embedding job retries 3x; source object is NOT blocked; object exists without embedding until retry succeeds or manual backfill.
- [ ] EC-2: Source object deleted before embedding job runs → `post_delete` signal enqueues delete job; create job finds no source object → skips silently.
- [ ] EC-3: Source object updated rapidly (multiple saves in <1s) → each save enqueues a job; jobs are idempotent; last one wins.
- [ ] EC-4: Search with no embeddings in workspace → returns `{"results": [], "total": 0}`.
- [ ] EC-5: Search with content_type filter that has no embeddings → returns empty results (no error).
- [ ] EC-6: WebSearchResult with <1500 tokens → stored as single chunk (no splitting).
- [ ] EC-7: WebSearchResult with 10,000+ tokens → split into ~7 chunks with overlap; each chunk is a separate Embedding row; `metadata.parent_id` links them.
- [ ] EC-8: `backfill_embeddings` run on workspace with 5000+ objects → enqueues jobs in batches of 100 to avoid overwhelming the queue; logs progress.
- [ ] EC-9: Embedding dimension mismatch (model changed) → `backfill_embeddings` with `--force` flag re-creates all embeddings.
- [ ] EC-10: MMR strategy with <top_k results in DB → returns all available results without error.
- [ ] EC-11: Full-text search query with special characters → `plainto_tsquery` handles sanitization; no SQL injection risk.
- [ ] EC-12: GenericForeignKey target model not in embeddable list → signal not registered; no embedding created.

## Environment Variables Required

```
# Already exists (shared with PROJ-6/9):
OPENROUTER_API_KEY=
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# New:
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

Document in `django-app/env/.env.template`.

## Dependencies

- PROJ-4 (Workspace & Membership — workspace FK, isolation)
- PROJ-5 (Niche model — embeddable source)
- PROJ-6 (NicheAnalysis, NicheProductVisionAnalysis, NicheProductEmotionalAnalysis, NicheKeywordAnalysis — embeddable sources)
- PROJ-7 (AmazonProduct — embeddable source)
- PROJ-8 (Idea model — embeddable source)
- PROJ-9 (Design model — not embedded, but Design.idea FK links to embedded Idea)
- PROJ-11 (Listing model — embeddable source)
- PROJ-17 (Web Search — WebSearchResult + ChatMessage embeddable sources, added when PROJ-17 is built)
- PROJ-18 (Agent — primary consumer of semantic search API)

## Decisions Log

| # | Topic | Decision | Rationale |
|---|-------|----------|-----------|
| 1 | Embedding model | OpenAI text-embedding-3-small (1536d) | Cheap, reliable, good quality via OpenRouter |
| 2 | Data scope | All data types | Agent needs full knowledge base |
| 3 | Timing | Async via django-rq post_save | No request blocking, retry on failure |
| 4 | Technology | pgvector in existing Supabase PG | No new service, JOINs with relational data |
| 5 | Table structure | Central Embedding table (GenericFK) | Cross-domain search in one query |
| 6 | Workspace isolation | Strict — every query filtered | Security requirement |
| 7 | API | Generic + convenience endpoints | Agent gets flexibility, UI gets shortcuts |
| 8 | Stale data | Auto-update via post_save signal | No stale embeddings, no manual sync |
| 9 | Chunking | Natural boundaries, only Web Search chunked | DB fields are natural chunks |
| 10 | Search method | Hybrid (vector + full-text) + MMR optional | Exact + semantic, best of both |
| 11 | Top-K / Threshold | Default 10/0.3, overridable per request | Good default, flexible when needed |
| 12 | Re-Ranking | None initially, add later if needed | YAGNI — hybrid score is strong baseline |

## Tech Design (Solution Architect)

> Decided: 2026-03-27 | Approved by user.

### A) Backend Architecture

**New Django app:** `vector_app` (already outlined in spec — formalized here)

```
vector_app/
├── models.py                           # Embedding (VectorField, SearchVectorField, GenericFK)
├── services.py                         # EmbeddingService (create, search, delete, hybrid query)
├── signals.py                          # post_save / post_delete on all embeddable models
├── tasks.py                            # django-rq: create_or_update_embedding, delete_embedding
├── chunking.py                         # WebSearchResult chunking (1500 tokens, 5% overlap)
├── api/
│   ├── views.py                        # SemanticSearch, NicheSimilar, IdeaSimilar, RelatedContent
│   ├── serializers.py                  # SearchRequest, SearchResult
│   └── urls.py
├── management/
│   └── commands/
│       ├── backfill_embeddings.py      # Backfill missing embeddings (batch, filterable)
│       └── embedding_stats.py          # Print per-content_type + workspace counts
├── admin.py                            # Embedding admin (read-only, stats)
└── tests/
```

### B) Frontend Architecture

**No dedicated page** — PROJ-15 is a backend-only foundation layer. Consumers:
- PROJ-17 Chat uses `POST /api/search/semantic/` for context retrieval
- PROJ-18 Agent uses `EmbeddingService.search()` internally
- PROJ-5/8 use convenience endpoints (`/similar/`, `/related-content/`) in existing UI

### C) Tech Decisions

| Decision | Why |
|----------|-----|
| `vector_app` separate from consuming apps | Foundation layer — all apps depend on it, it depends on none |
| Central `Embedding` table with GenericFK | Cross-domain search in one query. No per-model embedding tables |
| pgvector in existing Supabase PG | No new service. JOINs with relational data. Same host = fast |
| HNSW index (not IVFFlat) | Better recall at similar speed. No periodic reindexing needed |
| Hybrid search (0.7 vector + 0.3 full-text) | Exact matches (ASINs, brand names) + semantic results combined |
| Async embedding via django-rq post_save | No request blocking. Source objects never delayed by embedding failures |
| Idempotent upsert (unique content_type + object_id) | Multiple saves = last wins. No duplicate embeddings |
| `text-embedding-3-small` (1536d) via OpenRouter | Cheap ($0.02/1M tokens), reliable, good quality. Upgradeable later |
| Chunking only for WebSearchResult | DB fields are natural chunks. Only web content needs splitting |
| No dedicated worker | Embedding jobs are fast (<1s). Default queue sufficient |

### D) Infrastructure Changes

| Change | Where |
|--------|-------|
| `vector_app` registered | `INSTALLED_APPS` + `core/urls.py` |
| `pgvector` extension migration | `vector_app/migrations/0001_initial.py` |
| `pg_trgm` extension migration | same migration |
| `pgvector` Python package | `requirements.txt` |
| 2 new env vars | `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` in `.env.template` |

### E) New Packages

**Backend:**

| Package | Purpose |
|---------|---------|
| `pgvector` | Django VectorField + pgvector operations |
| `tiktoken` | Token counting for WebSearchResult chunking |

**Frontend:** None — backend-only feature.

---

## Verification Steps

1. Save a Niche → embedding job enqueued → Embedding record created in DB with 1536-dim vector
2. `POST /api/search/semantic/` with `{query: "camping humor"}` → returns ranked results across niches, ideas, products
3. Same query with `content_types: ["idea"]` → only idea results returned
4. `GET /api/niches/{id}/similar/` → top 10 similar niches by semantic similarity
5. `GET /api/ideas/{id}/similar/` → top 10 similar slogans across niches
6. `GET /api/niches/{id}/related-content/` → mixed results (ideas, products, keywords, research)
7. Hybrid search: query "B0C1234567" (ASIN) → exact match via full-text + semantic results combined
8. Update a Niche name → embedding auto-updated (idempotent overwrite)
9. Delete a Niche → embedding auto-deleted
10. OpenRouter down → embedding job retries 3x, source object not blocked
11. `python manage.py backfill_embeddings --content-type=idea` → enqueues jobs for all Ideas without embeddings
12. `python manage.py embedding_stats` → shows counts per content_type and workspace
13. WebSearchResult with 5000 tokens → split into ~4 chunks, each stored as separate Embedding
14. MMR strategy: `strategy=mmr` → results are diverse (not all from same niche)
15. Workspace isolation: search only returns results from authenticated user's workspace
16. Search with 0 embeddings → returns `{results: [], total: 0}` (no error)

---

## Future Enhancements (not MVP)

- LightRAG for unstructured Web Search knowledge graphs (evaluate with PROJ-17)
- Re-Ranking via LLM if search quality insufficient
- Contextual Retrieval if metadata context proves inadequate
- Embedding model upgrade to `text-embedding-3-large` if quality demands it
