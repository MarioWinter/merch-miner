# PROJ-21: Chat Attachments + Document RAG + Agentic Tool-Use

**Status:** Deferred (Post-MVP)
**Priority:** P1 (Post-MVP)
**Created:** 2026-04-26
**Last Updated:** 2026-04-27

> **Status note (2026-04-27):** Decision to ship the **image-upload + vision subset** as part of PROJ-20 for MVP. The full RAG / Agentic / Mistral-OCR / Gemini-YouTube / URL-Attachment system described in this spec is deferred to post-MVP. PROJ-21 stays as the canonical post-MVP roadmap document — re-activate when MVP traction justifies the build.

## Overview

Full attachment system for chat with **production-grade Document RAG** and **Agentic tool-use**. Replaces the disabled 📎 placeholder shipped in PROJ-20.

**Capabilities:**
- File-Upload: Images (vision), PDFs (Mistral OCR), CSV/Excel (DuckDB-backed predefined tools), drag-drop, paste-from-clipboard, multi-file
- URL-as-Attachment: Web pages (via Crawl4ai from PROJ-17), YouTube videos with **Notebook-LM-style audio+visual transcription via Gemini 2.5 Flash**
- Document RAG: Mistral OCR → Semantic Chunking → pgvector Embedding (PROJ-15 reuse) → BGE-Reranker → top-N to LLM
- Agentic Tool-Use: LangGraph agent with safe predefined LangChain `@tool`s (filter_rows, aggregate, top_n, column_stats, search_doc) — **no raw SQL, no Python REPL, injection-safe**
- Session-scoped attachment lifecycle (file remains queryable across all messages in the session)
- Workspace-isolated file storage (`MEDIA_ROOT/chat-attachments/{workspace_id}/{message_id}/`)

**Server requirements:** Strato server upgrade to ≥16 GB RAM before Phase 4 ships (BGE-Reranker requires headroom).

**Phasing (one PROJ-21 spec, sequential phases — all ship together as a single release):**

1. **Phase 1 — Foundation:** Storage model, upload endpoint, ClamAV, file preview UX, multi-file
2. **Phase 2 — Direct LLM Context:** Images via gpt-4.1-mini Vision, basic PDF text-extract, basic CSV markdown
3. **Phase 3 — RAG Pipeline:** Mistral OCR for PDFs, Semantic Chunking, pgvector embedding, retrieval
4. **Phase 4 — BGE Reranker:** Self-hosted CrossEncoderReranker via LangChain, top-K → top-N pipeline (server upgraded by then)
5. **Phase 5 — Agentic RAG + Predefined Tools:** LangGraph agent loop with `@tool`s for tables, multi-step retrieval, citations to source chunks
6. **Phase 6 — URL Attachments:** Web (Crawl4ai), YouTube (Gemini 2.5 Flash for audio+visual transcript), generic URL detection in input

## Dependencies

- PROJ-15 (Vector Database / pgvector) — RAG storage uses existing infrastructure
- PROJ-17 (Deep Web Search) — `Crawl4ai` integration is reused for Web-URL extraction; `worker-search` container hosts the BGE reranker
- PROJ-18 (OpenClaw Agent / LangGraph) — agent runtime patterns reused for Agentic RAG
- PROJ-20 (Chat UX Perplexity-Parity) — provides the chat UI shell, 📎 placeholder is unlocked here
- PROJ-5 (Niche List) — workspace + niche-context flows through to attachments

## User Stories

1. As a member, I want to drag images, PDFs, CSV/Excel files into the chat, so I can ask questions about my own documents.
2. As a member, I want to paste a YouTube URL and get a Notebook-LM-style summary that combines spoken content AND what's shown on screen, so I can absorb video tutorials in chat.
3. As a member, I want to paste a Web URL and have its content automatically extracted, so I can discuss articles without copy-pasting.
4. As a member, I want my uploaded PDF to be searched semantically by the AI when I ask follow-up questions, so I don't waste tokens stuffing whole files into prompts.
5. As a member, I want the AI to compute correct aggregations on my CSV (e.g. average price in Q3) so I can trust numbers instead of hallucinated answers.
6. As an admin, I want to set the global Vision model in Django Admin, so I can switch it for the whole workspace without re-deploys.
7. As a member, I want to see attachment-cards in the input area before sending, with thumbnails + remove-X, so I can review before committing.
8. As a member, I want the AI to keep my attachments accessible across follow-up messages in the same session, so I don't have to re-upload.
9. As a member, I want my files automatically purged after 90 days, so storage doesn't grow unbounded.
10. As a security-conscious user, I want files to be virus-scanned and validated by mime-magic-bytes before processing, so a malicious attachment can't compromise the workspace.

## Acceptance Criteria

### Phase 1 — Foundation

- [ ] AC-1: New Django app `chat_attachments_app` with `ChatAttachment` model: UUID pk, `workspace` FK (CASCADE), `message` FK (`ChatMessage`, nullable, on_delete=SET_NULL — preserved if message deleted but file kept until purge), `uploaded_by` FK (User), `file` (FileField → `chat-attachments/{workspace_id}/{message_id_or_orphan}/{uuid}.{ext}`), `original_filename` (CharField 500), `mime_type` (CharField 100, populated from python-magic), `size_bytes` (BigInteger), `attachment_type` (choices: `image`, `pdf`, `csv`, `excel`, `web_url`, `youtube_url`), `extracted_text` (TextField, blank — populated by ingestion pipeline), `metadata` (JSONField — e.g. page_count, row_count, video_duration_s, source_url, video_id), `ingestion_status` (choices: `pending`, `running`, `completed`, `failed`), `error_message` (TextField, blank), `created_at`, `purged_at` (DateTimeField, nullable).
- [ ] AC-2: Upload endpoint `POST /api/chat/attachments/` (multipart): accepts up to **5 files per request** (per-message limit), each ≤25 MB, total ≤100 MB. Returns list of created `ChatAttachment` records with `ingestion_status='pending'`.
- [ ] AC-3: Upload validation: python-magic mime-detection (NOT trusting Content-Type header), whitelist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`, `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`). Reject with 400 + clear error if mime not whitelisted.
- [ ] AC-4: ClamAV integration: new `clamav` service in `docker-compose.yml` (~500 MB RAM). Upload triggers async django-rq job that calls `pyclamd` to scan; if infected → `ingestion_status='failed'`, `error_message='Virus detected'`, file deleted from disk. Frontend polls or receives via WebSocket later.
- [ ] AC-5: Workspace-quota enforcement: each workspace has `attachment_quota_bytes` (default 5 GB, in `Workspace` model). New uploads rejected with 413 + `"Workspace storage limit reached"` if would exceed.
- [ ] AC-6: Daily django-rq scheduled job `purge_old_attachments`: deletes `ChatAttachment` records (and their files) where `created_at < now - 90 days`. Sets `purged_at` on the record (kept as historical row). Cascade-delete pgvector chunks via FK.
- [ ] AC-7: ChatMessage delete (CASCADE on session delete): linked attachments are NOT immediately deleted — they remain orphaned (FK SET_NULL) and follow normal 90-day purge. This avoids losing files if user accidentally deletes a session.
- [ ] AC-8: Frontend `AttachmentBar.tsx` (in `MultiPurposeDrawer/panels/`) renders above `ChatInputBar` (from PROJ-20) when ≥1 attachment in flight. Shows preview-card per attachment: thumbnail (image) or type-icon (file), filename (truncated 30 chars), size, ingestion-status badge, ✕-button to remove.
- [ ] AC-9: Drag-Drop on the chat area uses `@dnd-kit` (already in stack) with `useDroppable`. Hover state: dashed border on input. Drop fires upload.
- [ ] AC-10: Paste-from-clipboard: `onPaste` handler on textarea reads `clipboardData.items`, filters image-types, uploads via same endpoint. Triggers when user presses ⌘+V / Ctrl+V on input.
- [ ] AC-11: Send-button is disabled until ALL attachments reach `ingestion_status='completed'` (or `failed` — user can still send without failed ones, with warning).
- [ ] AC-12: Per-attachment progress: linear progress bar in attachment-card while `ingestion_status='running'`. Status text below: "Scanning…", "OCR…", "Embedding…", "Ready ✓".

### Phase 2 — Direct LLM Context (Images, basic Tables)

- [ ] AC-13: Image attachments are sent to LLM as **vision messages** (OpenAI Chat Completions / Anthropic Messages format, image_url / image content block). Default model: `gpt-4.1-mini` (admin-configurable, see AC-19).
- [ ] AC-14: Image preprocessing: server-side resize to max 2048×2048 (preserves aspect, uses `Pillow`). Original kept on disk; resized version sent to LLM. Reduces vision token cost ~4×.
- [ ] AC-15: Hard-reject if image attachment alone would push message context past selected model's token limit (per-model limits configured in `MODEL_LIMITS` dict). Frontend shows error + disables send. **NOTE:** This applies only to direct vision; PDF/CSV/Excel use RAG and are NOT subject to context-stuffing limits.
- [ ] AC-16: Basic CSV/Excel handling for Phase 2 (before tools land in Phase 5): first 100 rows rendered as **Markdown table** in LLM context with hint `_Showing 100 of N rows_`. Phase 5 supersedes this with predefined tools.
- [ ] AC-17: Basic PDF handling for Phase 2 (before Mistral OCR in Phase 3): pdfplumber extracts text → first 50 pages → plain-text context. Phase 3 supersedes this with Mistral OCR + semantic chunking.

### Phase 3 — Mistral OCR + Semantic Chunking + pgvector

- [ ] AC-18: New service `MistralOCRService` in `chat_attachments_app/services/mistral_ocr.py`. Calls Mistral OCR API (`mistral-ocr-latest`) with PDF as base64. Returns Markdown content with preserved layout (tables, headings, captions). Handles up to 1000 pages. ENV var `MISTRAL_API_KEY`.
- [ ] AC-19: New singleton model `AppSettings` (django-solo or hand-rolled): fields `vision_model` (CharField, default `'gpt-4.1-mini'`, choices from OpenRouter vision-capable list), `mistral_ocr_enabled` (Bool, default True), `gemini_youtube_enabled` (Bool, default True). Editable via Django Admin. Read on every chat request.
- [ ] AC-20: PDF ingestion pipeline (django-rq job): upload → ClamAV → Mistral OCR → Markdown text → semantic chunking → embeddings → pgvector. Status updates persisted on `ChatAttachment.ingestion_status`.
- [ ] AC-21: Semantic chunking uses LangChain `SemanticChunker` (embedding-based boundary detection) with `breakpoint_threshold_type='percentile'`, target chunk size 300-500 tokens. Markdown headers preserved as chunk metadata.
- [ ] AC-22: Embeddings via OpenRouter `text-embedding-3-small` (existing setup from PROJ-15). Stored in pgvector via LangChain `PGVector` integration. New table `chat_attachment_chunks`: chunk text, embedding, attachment FK, chunk_index, source_metadata JSONB.
- [ ] AC-23: Per-attachment chunk count cap: max 1000 chunks/attachment (PDFs >1000 chunks are truncated, frontend warns user).
- [ ] AC-24: CSV/Excel ingestion: parse via openpyxl/pandas, store DataFrame as **Apache Parquet file** alongside the original (`{uuid}.parquet`) for fast subsequent loads. Schema (column names + dtypes) cached in `ChatAttachment.metadata.schema`.

### Phase 4 — BGE Reranker

- [ ] AC-25: New `RerankerService` wraps LangChain `CrossEncoderReranker` with model `BAAI/bge-reranker-base`. Loaded once at worker boot, kept warm in process memory. Located in `worker-search` container (reuses PROJ-17 worker).
- [ ] AC-26: Retrieval-with-reranking flow: vector-search top-20 chunks → reranker scores all 20 against query → return top-5 (sorted by reranker score). Configurable via `RERANK_TOP_K` (default 20) and `RERANK_TOP_N` (default 5) env vars.
- [ ] AC-27: Reranker latency budget: ≤500ms p95 for 20 chunks on production hardware (Strato post-upgrade, 16+ GB RAM, 4+ vCPU). Logged via Langfuse.
- [ ] AC-28: Fallback: if reranker unavailable (e.g. worker down), retrieval falls back to vector-search-only top-5 with notistack warning `"Reranker offline — Antwortqualität reduziert"` in dev/admin views; silent in user-facing prod.

### Phase 5 — Agentic RAG + Predefined LangChain Tools

- [ ] AC-29: New LangGraph agent `chat_attachments_agent` (in `chat_attachments_app/agents/`) using `create_react_agent`. Agent receives: user query, list of available attachments, tool registry. Iterates max 5 steps before forced answer.
- [ ] AC-30: Agent tool registry — exactly these 5 tools registered as LangChain `@tool`:
  - `search_document(query: str, attachment_id: UUID) -> list[Chunk]` — vector-search + rerank within ONE attachment, returns top-5 chunks with text + source_metadata
  - `filter_rows(attachment_id: UUID, column: str, op: Literal["=","!=","<",">","<=",">=","contains"], value: str | float) -> dict` — filters DataFrame, returns first 50 matching rows + total_match_count. Column name validated against attachment's cached schema.
  - `aggregate(attachment_id: UUID, group_by: str | None, agg_col: str, agg_fn: Literal["sum","mean","min","max","count","nunique"]) -> dict` — groups (optional) and aggregates. Column names validated.
  - `top_n(attachment_id: UUID, n: int, sort_by: str, ascending: bool = False) -> list[dict]` — top-N rows by column. n max 100.
  - `column_stats(attachment_id: UUID, column: str) -> dict` — pandas .describe() output for one column.
- [ ] AC-31: All tools enforce **column-name whitelist** validation against `ChatAttachment.metadata.schema`. Invalid column → tool returns error string `"Column 'X' not found. Available: [a, b, c]"` so LLM can self-correct.
- [ ] AC-32: All tools enforce **workspace-isolation** at query-time: `ChatAttachment.objects.filter(id=attachment_id, workspace=request.workspace).get()`. 404 if cross-workspace access attempted.
- [ ] AC-33: NO raw-SQL tool. NO Python-eval tool. NO `pandas_query` with arbitrary expressions. Only the 5 tools in AC-30.
- [ ] AC-34: Agent answer includes **citations** in the format `[ATT:N:CHUNK_K]` for document chunks and `[ATT:N:TOOL]` for tool-call results. Frontend renders these inline (PROJ-20 citation logic extended) — click on `[ATT:1:CHUNK_3]` opens an attachment-detail panel with the relevant chunk highlighted.
- [ ] AC-35: LangGraph agent run is observable via Langfuse: each tool-call, retrieval, and reranker invocation is a span.

### Phase 6 — URL Attachments (Web + YouTube)

- [ ] AC-36: URL auto-detection in input: regex matches `^https?://...` and `^www\....`. On paste-of-pure-URL (no surrounding text), auto-create attachment-card; user can remove with ✕.
- [ ] AC-37: Web URL ingestion (existing PROJ-17 `Crawl4ai` reused): URL → Crawl4ai → Markdown → same semantic-chunking-and-embedding pipeline as PDFs. `ChatAttachment.attachment_type='web_url'`, `metadata.source_url=...`.
- [ ] AC-38: YouTube URL ingestion via **Gemini 2.5 Flash**: URL detected by `youtube_id_regex`. New `GeminiVideoService` uploads YouTube URL to Gemini API (`google-genai` SDK) with prompt `"Transcribe spoken audio AND describe what's shown visually, with timestamps in [MM:SS] format."`. Returns combined audio+visual transcript.
- [ ] AC-39: YouTube ingestion writes Gemini transcript to `extracted_text`, then runs same semantic-chunking+embedding pipeline. `metadata` includes `video_id`, `title`, `duration_s`, `channel`, `thumbnail_url`.
- [ ] AC-40: ENV var `GEMINI_API_KEY` required. New entry in `django-app/.env.template` with comment.
- [ ] AC-41: YouTube max-duration: 4 hours per video. Longer rejected with `"Video exceeds 4-hour limit"`.
- [ ] AC-42: Google Gemini API failures (404 video, region-blocked, quota): clear error → `ingestion_status='failed'` with explanatory `error_message`. User sees attachment-card with error-state and `[Retry]` button.

### Cross-Cutting

- [ ] AC-43: Backend integration with PROJ-20 `📎` icon: PROJ-20 ships with `disabled` placeholder; PROJ-21 enables it. The icon-button click opens a hidden file-input + drop-zone. No PROJ-20 code modified — feature flag `ATTACHMENTS_ENABLED` (env, default False) controls visibility, set to True at PROJ-21 deploy.
- [ ] AC-44: i18n: all user-visible strings translated DE + EN. Keys grouped under `chatAttachments.*` (e.g. `chatAttachments.upload.error.tooLarge`).
- [ ] AC-45: All endpoints under `/api/chat/attachments/...` are protected by `CookieJWTAuthentication` + `IsAuthenticated` + workspace-membership check.
- [ ] AC-46: New requirements added to `django-app/requirements.txt`:
  - `python-magic` (mime detection from magic bytes)
  - `pyclamd` (ClamAV client)
  - `pdfplumber` (Phase 2 fallback)
  - `pandas` + `pyarrow` (DataFrame + Parquet)
  - `langchain-experimental` (SemanticChunker)
  - `sentence-transformers` (CrossEncoderReranker dependency)
  - `google-genai` (Gemini API)
  - `mistralai` (Mistral OCR API)
- [ ] AC-47: Frontend new packages:
  - `react-pdf` or similar for PDF thumbnail preview
  - `mime-types` for client-side mime guessing (still server-validated)

## Edge Cases

- [ ] EC-1: User uploads a PDF with 0 extractable text (scanned image) AND Mistral OCR also fails → fall back to first-page-as-image-vision (gpt-4.1-mini). If still fails → `ingestion_status='failed'` with clear error.
- [ ] EC-2: ClamAV scan times out (>30s) → `ingestion_status='failed'`, file deleted, user notified. Don't trust unscanned files.
- [ ] EC-3: User starts upload, navigates away mid-upload → upload continues background (via `xhr` ref kept in component) BUT can be cancelled by clicking attachment ✕ before send.
- [ ] EC-4: Two users in same workspace upload identical files (same hash) → de-duplication is **NOT** implemented in MVP (each upload = own row). Storage cost minor.
- [ ] EC-5: User sends message with attachments while ANOTHER stream is active in same session → standard PROJ-17 EC-7 logic: previous stream cancelled, new stream starts with attachments included.
- [ ] EC-6: Workspace approaches quota: at 80% usage, banner appears in workspace settings `"5 GB / 4 GB used — purge old chats?"`. At 100% → upload rejected.
- [ ] EC-7: User pastes a URL that's BOTH in a sentence AND is a YouTube link (e.g. "What about https://youtube.com/...") → auto-create attachment ONLY if URL is on its own line OR text-around-URL is whitespace. Otherwise treated as plain-text reference.
- [ ] EC-8: PDF is encrypted/password-protected → `ingestion_status='failed'` with message `"PDF is password-protected and cannot be processed"`.
- [ ] EC-9: Excel file has multiple sheets → ingestion processes all sheets, each becomes a separate "logical" attachment-chunk-set. UI shows tabs per sheet in attachment-detail view. Tools accept `(attachment_id, sheet_name)` (Phase 5+).
- [ ] EC-10: Attachment exists but pgvector chunks were never created (ingestion failure or pre-Phase-3) → tools return error `"Attachment N is not yet indexed for search"` so LLM can apologize gracefully.
- [ ] EC-11: User deletes a single attachment from a sent message → file deleted from disk, pgvector chunks deleted, but message-content (the user's text) preserved. Attachment-card in chat history shows `"[Attachment removed]"`.
- [ ] EC-12: Image dimensions are extreme (e.g. 50000×50000 PNG) → `Pillow.MAX_IMAGE_PIXELS` triggers DecompressionBomb warning → upload rejected with `"Image dimensions too large"`.
- [ ] EC-13: User uploads same attachment AND types its summary in input → both are sent. LLM sees attachment + user's interpretation. No de-duplication logic.
- [ ] EC-14: Gemini API quota exceeded mid-day → YouTube uploads switch to soft-fail mode for 1 hour: attachments accept but processing-job retries every 10min until quota resets. Frontend shows `"Processing — quota throttled"`.
- [ ] EC-15: User regenerates a message that had attachments → attachments are RE-USED (no re-upload), agent runs again with same attachment context. Tokens NOT refunded for re-use.
- [ ] EC-16: A chunk in a CSV is so wide (50+ columns, long strings) it alone exceeds embedding model's 8k token limit → chunk is truncated to fit, warning logged but ingestion continues.
- [ ] EC-17: User attaches a file, types nothing else, hits Send → message body is empty but attachments present. Default prompt sent to LLM: `"Please analyze the attached {file_type}."` (locale-aware).
- [ ] EC-18: Web-URL attached via paste → Crawl4ai fails (404, blocked by robots.txt, JS-only page) → `ingestion_status='failed'` with reason. User can manually retry once.

## Technical Requirements

### Performance
- Upload to `pending` status acknowledgment: ≤500ms p95
- Image vision response start (first chunk): ≤3s p95
- PDF Mistral OCR (50 pages): ≤30s p95
- PDF semantic chunking + embedding (200 chunks): ≤15s p95 (parallel embedding-batch via OpenRouter)
- BGE-Reranker scoring 20 chunks: ≤500ms p95
- YouTube Gemini transcription (1h video): ≤90s p95
- Agentic RAG full answer (5 tool-iterations): ≤30s p95

### Server (Strato post-upgrade target)
- ≥16 GB RAM (BGE-base ~700 MB resident, plus pgvector queries, plus existing stack)
- ≥4 vCPU
- ≥100 GB disk for `MEDIA_ROOT/chat-attachments/` (user files) + `chat_attachment_chunks` table
- Required new Docker services: `clamav` (~500 MB RAM, daily signature update via cron)

### Security
- Workspace isolation enforced at ORM level on every endpoint and every tool-call
- python-magic mime detection (NEVER trust Content-Type header)
- ClamAV scan before any file becomes available to LLM
- File-path generation uses UUID + safe slug (no user-provided filename in path)
- Predefined-tool-only LLM access to data (no SQL injection vector, no code execution)
- Workspace storage quota enforced (DoS prevention)
- Rate-limit upload endpoint: 20 uploads / user / minute (DRF throttling)
- Sanitize all attachment metadata before LLM context (strip prompt-injection patterns)

### Browser Support
- Chrome 110+, Firefox 110+, Safari 16+ (matches PROJ-17 baseline)
- Drag-drop tested on macOS Finder, Windows Explorer, mobile Safari (file-picker fallback)

### Observability
- Each attachment lifecycle event (upload, scan, ocr, chunk, embed, query, rerank, agent-step) logged to Langfuse as a span
- Failed ingestions logged with full stack-trace to Sentry (or stdout in dev)

## Environment Variables Required (new)

> **API-Key Strategy:** OpenRouter handles 90% of LLM calls (embeddings, image vision, chat completions, all standard chat traffic). Two direct-API keys are required for features OpenRouter does NOT proxy:
> - **`MISTRAL_API_KEY`** — Mistral's `mistral-ocr-latest` is a *specialized OCR endpoint*, not a chat-completion model. OpenRouter only proxies chat-completion APIs, so this key must be direct.
> - **`GEMINI_API_KEY`** — Gemini's native YouTube-URL ingestion (`Part.from_uri(file_uri="youtube.com/...")`) is a Google File-API-specific feature only accessible via the `google-genai` SDK directly. OpenRouter exposes Gemini chat models but NOT this multimodal-video input feature.

```
OPENROUTER_API_KEY=<key>        # most LLM calls (embeddings, vision, chat) — already in stack
MISTRAL_API_KEY=<key>           # PDF OCR via mistral-ocr-latest specialized endpoint (NOT via OpenRouter)
GEMINI_API_KEY=<key>            # YouTube transcription via google-genai SDK (NOT via OpenRouter)
ATTACHMENTS_ENABLED=true        # feature flag (PROJ-20 ships False, PROJ-21 ships True)
RERANK_TOP_K=20                 # vector-search top-K before rerank
RERANK_TOP_N=5                  # post-rerank top-N to LLM
CLAMAV_HOST=clamav              # clamav docker service hostname
CLAMAV_PORT=3310                # clamav default port
ATTACHMENT_MAX_FILE_BYTES=26214400      # 25 MB / file
ATTACHMENT_MAX_TOTAL_BYTES=104857600    # 100 MB / message
WORKSPACE_DEFAULT_QUOTA_BYTES=5368709120  # 5 GB / workspace default
ATTACHMENT_PURGE_DAYS=90        # auto-purge cutoff
```

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Storage = local `MEDIA_ROOT` | Simplest, MVP-OK, mirrors `publish_app` pattern. No S3 vendor-lock. |
| 2 | Mistral OCR for PDFs (not pdfplumber) | Handles tables, layouts, images in PDFs. State-of-the-art. ~$1/1000 pages — affordable. |
| 3 | Auto-Purge after 90 days | Bounds storage growth; standard data-retention policy. |
| 4 | Vision model `gpt-4.1-mini` global, Admin-only via Django Admin | User decision: cheap + decent quality for images. Centralized control. |
| 5 | ClamAV in docker-compose | Real virus scanning vs trust-only. ~500 MB RAM acceptable. |
| 6 | LangChain `@tool` predefined functions for tables (no SQL, no Python REPL) | User decision: injection-safety > flexibility. 5 tools cover 95% of analytical questions. |
| 7 | Session-scoped attachment lifecycle | Matches ChatGPT/Claude.ai mental model; user can refer to file in follow-ups. |
| 8 | Mega-feature single spec (Phases 1-6) | User preference: ship cohesive feature, not 3-spec dance. |
| 9 | URL-as-Attachment included (Web + YouTube) | Conceptually same UX (attach a thing); shared ingestion pipeline (chunks + RAG). |
| 10 | Gemini 2.5 Flash for YouTube (audio + visual) | Notebook-LM-parity. $0.30/h-video, native multimodal. Self-built Whisper+vision-frames is 6× more code for worse quality. |
| 11 | Self-hosted BGE-Reranker via LangChain CrossEncoderReranker | DSGVO-safe, no per-query cost, predictable latency. Requires Strato server upgrade to 16 GB. |
| 12 | Server upgrade on Strato to 16 GB RAM | Current 8 GB at 92% — cannot fit BGE + Phase 1-6 stack without OOM-risk. |
| 13 | Predefined tools only — no SQL, no Python eval, no MCP-with-raw-query | User concern: prompt-injection from file content (e.g. malicious CSV cell). Whitelist approach is structurally safe. |
| 14 | Hard-Reject on context overflow only for direct vision (images) | RAG side-steps token-limit issue for PDFs/CSV/Excel via retrieval. |
| 15 | 5 files / message, 25 MB / file, 100 MB / message, 5 GB / workspace | Reasonable defaults; configurable via env vars + Workspace model. |
| 16 | DuckDB NOT used in MVP | Tools operate directly on pandas DataFrames (cached as Parquet). DuckDB is overkill for tool-bounded queries. |
| 17 | Workspace-knowledge-bank (cross-session) deferred | Session-scoped first; workspace-shared file library is its own UX (multi-user permissions) — separate spec later if demanded. |
| 18 | Hybrid API-Key strategy (OpenRouter + Mistral direct + Gemini direct) | OpenRouter only proxies chat-completion APIs. Mistral OCR (`mistral-ocr-latest`) is a specialized non-chat endpoint; YouTube native ingestion (`Part.from_uri`) is Google's File-API-specific feature. Both require direct API access. Standard chat/embedding/vision still routes through existing OpenRouter integration — only the 2 specialized features need direct keys. |

## Out of Scope (deferred)

- **OCR for non-PDF images** (we send images straight to Vision model — much better than OCR for image-content questions)
- **Audio file uploads** (mp3, wav) — defer until users ask; Whisper integration is its own feature
- **Real-time collaborative editing of attachments** — chat is read-only of attachments
- **Workspace-shared file library** (cross-session attachment reuse) — see Decision 17
- **Attachment branching on Regenerate** (re-uploads vs reuse) — we re-use, no branching
- **Inline editing of extracted text** (correcting OCR errors before LLM sees it) — power-user feature, defer
- **Custom embedding model selection per workspace** — default OpenRouter `text-embedding-3-small` for all
- **MCP-server wrapping our tools** — see PROJ-21 Decision 13; could be added later via `langchain-mcp-adapters` if portability desired
- **Whisper fallback for caption-less YouTube** — Phase 6 rejects with clear error; Whisper + yt-dlp can be a follow-up enhancement
- **Multi-page CSV / Excel sheet selection UI** — Phase 5 EC-9 handles tabs minimally

## Verification Steps

1. Upload a 30-page text-heavy PDF → assert Mistral OCR extracts correctly → ask agent "summarize section 3" → verify it cites correct chunk
2. Upload an Excel file with sales data → ask "what's the average price grouped by quarter?" → verify agent uses `aggregate(group_by='quarter', agg_col='price', agg_fn='mean')` → answer matches manual calculation
3. Paste a YouTube tutorial URL → after ingestion, ask "what does the speaker show at the 5-minute mark?" → verify Gemini transcript captured visual details
4. Upload an image of a chart → ask "what trend does this chart show?" → verify gpt-4.1-mini Vision answers correctly (no RAG involved)
5. Upload a malicious EICAR test file → assert ClamAV detects it → `ingestion_status='failed'`
6. Upload 6 files in one request → assert 400 error `"Max 5 files per message"`
7. Upload to a workspace at 4.99 GB usage with a 50 MB file → assert 413 quota error
8. Wait 91 days (or run purge job manually with `now - 91d`) → assert old attachments + their pgvector chunks are deleted
9. Run Playwright E2E: drag-drop image, paste image from clipboard, type message, send → assert assistant response includes vision analysis
10. Stress-test reranker: 100 concurrent requests for 20-chunk reranks → assert p95 latency ≤500 ms

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
