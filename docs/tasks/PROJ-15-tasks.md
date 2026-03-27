# PROJ-15: Vector Database (AI Memory) — Implementation Tasks

## Key Technical Decisions (from architecture review 2026-03-27)

- **New Django app:** `vector_app` — foundation layer, all apps depend on it
- **Central `Embedding` table** with GenericFK — cross-domain search in one query
- **pgvector** in existing Supabase PG — no new service, JOINs with relational data
- **HNSW index** (not IVFFlat) — better recall, no periodic reindexing
- **Hybrid search** (0.7 vector + 0.3 full-text) — exact + semantic combined
- **Async embedding** via django-rq post_save — no request blocking
- **`text-embedding-3-small`** (1536d) via OpenRouter — cheap, reliable
- **No dedicated worker** — embedding jobs fast (<1s), default queue sufficient
- **Backend-only** — no frontend page, consumed by PROJ-17/18 and convenience endpoints

---

## Phase 1: Backend Foundation

- [ ] AC-1: Migration: `CREATE EXTENSION IF NOT EXISTS vector` (pgvector) in Supabase PG
- [ ] AC-2: Migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm` (full-text trigram support)
- [ ] Create `vector_app/` Django app, register in `INSTALLED_APPS`
- [ ] Create `vector_app/api/` subpackage
- [ ] Wire into `core/urls.py` under `/api/search/`
- [ ] `pgvector` + `tiktoken` in `requirements.txt`
- [ ] Env vars: `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS` in `.env.template`

---

## Phase 2: Embedding Model

- [ ] AC-3: `Embedding` model: UUID pk, `content_type` FK (ContentType), `object_id` UUID, `workspace` FK (CASCADE, db_index), `embedding` VectorField(dimensions=1536), `text_input` TextField, `metadata` JSONField(default=dict), `search_text` TextField, `search_vector` SearchVectorField (auto-updated GIN-indexed), `created_at`, `updated_at`
- [ ] AC-4: HNSW index on `embedding` column (`vector_cosine_ops`)
- [ ] AC-5: GIN index on `search_vector` column
- [ ] AC-6: Composite index on `(workspace_id, content_type_id)`
- [ ] AC-7: `unique_together = [('content_type', 'object_id')]` — one embedding per source, upsert on update
- [ ] Initial migration
- [ ] Admin registration (read-only, stats display)

---

## Phase 3: Embedding Service

- [ ] AC-8: `EmbeddingService` class in `services.py`: `create_embedding(instance)`, `search(query, workspace_id, ...)`, `delete_embedding(instance)`
- [ ] AC-9: `create_embedding()`: call OpenRouter with `text-embedding-3-small`, store result. Populate `text_input` from `instance.get_embedding_text()`, `search_text` same, `metadata` with source context
- [ ] AC-10: `search()`: hybrid query — vector cosine similarity + tsvector full-text. Combined score: `0.7 * vector_score + 0.3 * text_score`. Always filtered by `workspace_id`. Optional `content_types` filter
- [ ] AC-11: `search()` strategy parameter: `similarity` (default, cosine) or `mmr` (Max Marginal Relevance, lambda=0.7, fetch top_k*2 then diversify)
- [ ] AC-12: `search()` supports `top_k` (default 10) and `threshold` (default 0.3) overrides

---

## Phase 4: Text Extraction (get_embedding_text)

- [ ] AC-13: Add `get_embedding_text()` method to each embeddable model:
- [ ] `Niche`: `name + " " + notes`
- [ ] `NicheAnalysis`: `niche_summary + " " + emotional_reality + " " + design_concepts + " " + dominant_design_aesthetics`
- [ ] `NicheProductVisionAnalysis`: `slogan_text + " " + meaning_context + " " + visual_style`
- [ ] `NicheProductEmotionalAnalysis`: `original_slogan + " " + tone + " " + adaptation_formula`
- [ ] `NicheKeywordAnalysis`: `all_keywords_flat`
- [ ] `Idea`: `slogan_text + " " + why_it_works`
- [ ] `Listing`: `title + " " + bullet_1..5 + " " + description`
- [ ] `AmazonProduct`: `title + " " + brand + " " + bullets`
- [ ] ChatMessage + WebSearchResult: deferred to PROJ-17 (models don't exist yet)

---

## Phase 5: Async Embedding Pipeline

- [ ] AC-14: `signals.py`: `post_save` on all embeddable models → enqueue `create_or_update_embedding` job on `default` queue
- [ ] AC-15: `post_delete` on all embeddable models → enqueue `delete_embedding` job
- [ ] AC-16: `tasks.py: create_or_update_embedding(content_type, object_id)` — idempotent upsert. If embedding exists → overwrite
- [ ] AC-17: Retry on failure: 3 retries with exponential backoff (10s, 30s, 90s). After 3 failures → log error, don't block source
- [ ] AC-18: `chunking.py`: WebSearchResult chunking — 1500 tokens per chunk, 5% overlap. Each chunk = separate Embedding row with `metadata.chunk_index` + `metadata.parent_id`. Uses `tiktoken` for token counting
- [ ] Register signals in `apps.py → ready()`

---

## Phase 6: API Endpoints

- [ ] AC-19: `POST /api/search/semantic/` — body: `{query, content_types (optional), top_k (default 10), threshold (default 0.3), strategy (default "similarity")}`. Workspace-scoped from auth
- [ ] AC-20: Response shape: `{results: [{score, content_type, object_id, text_preview (200 chars), metadata}], total, query, strategy}`
- [ ] AC-21: `GET /api/niches/{id}/similar/` — top 10 similar niches. Uses NicheAnalysis embedding, falls back to Niche name+notes
- [ ] AC-22: `GET /api/ideas/{id}/similar/` — top 10 similar ideas across all niches
- [ ] AC-23: `GET /api/niches/{id}/related-content/` — mixed results (ideas, products, keywords, research) related to niche embedding
- [ ] AC-24: Workspace isolation: every query filtered by `workspace_id`
- [ ] AC-25: `EmbeddingService.search()` ALWAYS filters by workspace — no cross-workspace queries
- [ ] AC-26: Workspace deletion cascades to all embeddings

---

## Phase 7: Serializers

- [ ] `SemanticSearchRequestSerializer`: query (required), content_types (optional list), top_k (default 10), threshold (default 0.3), strategy (choices: similarity/mmr)
- [ ] `SemanticSearchResultSerializer`: score, content_type, object_id, text_preview, metadata
- [ ] `SimilarNicheSerializer`: id, name, score, shared context
- [ ] `SimilarIdeaSerializer`: id, slogan_text, niche_name, score
- [ ] `RelatedContentSerializer`: content_type, object_id, text_preview, score, metadata

---

## Phase 8: Management Commands

- [ ] AC-27: `backfill_embeddings` command: processes objects without embeddings. Supports `--content-type=idea` filter, `--batch-size=100`. Enqueues jobs via django-rq (non-blocking). `--force` flag re-creates all embeddings
- [ ] AC-28: `embedding_stats` command: prints count per content_type and workspace. Shows objects missing embeddings

---

## Phase 9: Tests

### Backend

- [ ] Embedding model: create, upsert (same content_type+object_id overwrites), delete, cascade on workspace delete
- [ ] EmbeddingService.create_embedding: calls OpenRouter, stores 1536-dim vector, populates text_input + search_text + metadata
- [ ] EmbeddingService.search: hybrid query returns ranked results, respects threshold, workspace filter
- [ ] EmbeddingService.search with MMR strategy: diversified results
- [ ] EmbeddingService.search with content_types filter: only matching types returned
- [ ] post_save signal: creates embedding job on save, idempotent on rapid saves
- [ ] post_delete signal: deletes embedding
- [ ] Retry logic: 3 retries with backoff, source object not blocked
- [ ] Chunking: WebSearchResult split correctly (1500 tokens, 5% overlap, metadata.chunk_index)
- [ ] API: `POST /api/search/semantic/` returns correct shape, workspace-scoped
- [ ] API: `/api/niches/{id}/similar/` returns similar niches
- [ ] API: `/api/ideas/{id}/similar/` returns similar ideas
- [ ] API: `/api/niches/{id}/related-content/` returns mixed content types
- [ ] backfill_embeddings: enqueues jobs for missing embeddings, respects --content-type filter
- [ ] embedding_stats: correct counts per content_type
- [ ] Workspace isolation: no cross-workspace results
- [ ] Ruff: 0 errors

### Edge Cases

- [ ] EC-1: OpenRouter down → 3 retries, source object not blocked
- [ ] EC-2: Object deleted before embedding job → job skips silently
- [ ] EC-3: Rapid saves → idempotent, last wins
- [ ] EC-4: Empty workspace search → `{results: [], total: 0}`
- [ ] EC-8: Backfill 5000+ objects → batched, logged
- [ ] EC-10: MMR with <top_k results → returns all available
- [ ] EC-11: Special characters in query → sanitized by plainto_tsquery

---

## Verification Checklist

- [ ] `vector_app` registered, migrations applied (pgvector + pg_trgm extensions)
- [ ] Embedding model with HNSW + GIN indexes
- [ ] EmbeddingService: create, search (hybrid), delete
- [ ] post_save signals fire on all embeddable models (Niche, NicheAnalysis, Idea, Listing, AmazonProduct, etc.)
- [ ] Hybrid search: vector + full-text combined scoring (0.7/0.3)
- [ ] MMR strategy returns diverse results
- [ ] 4 API endpoints functional + workspace-scoped
- [ ] Chunking for WebSearchResult (1500 tokens, 5% overlap)
- [ ] backfill_embeddings + embedding_stats commands work
- [ ] Retry 3x with backoff, source objects never blocked
- [ ] Workspace isolation: no cross-workspace queries
- [ ] All tests pass, lint clean
