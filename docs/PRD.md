# Product Requirements Document

## Vision

Merch Miner is a Business OS for Print on Demand (POD) sellers that compresses the full creative pipeline — from Amazon market research to published listings — into a single agentic workspace.

Eliminates spreadsheet chaos and tool-switching by connecting niche data, AI-generated designs, and listing copy in one collaborative environment. The core loop: research a niche → generate ideas/slogans → create designs → publish listings.

## Target Users

**Primary:** Small POD teams (2–5 people) selling on Merch by Amazon (MBA).

**Pain points:**
- Niche research scattered across MerchMatrix, Flying Research, Amazon search, and spreadsheets
- No repeatable workflow from research → design → listing
- No team visibility into who is working on what
- Manual copy-paste uploads to MBA

**Profile:** Semi-technical sellers who understand the POD business model, use AI tools, and want to systematize their operation without building custom software.

## Core Features (Roadmap)

| Priority | Feature | Status |
|----------|---------|--------|
| P0 (MVP) | PROJ-1: User Auth (Email + Google OAuth2) | Deployed |
| P0 (MVP) | PROJ-2: Frontend Docker Integration | Deployed |
| P0 (MVP) | PROJ-3: CI/CD & DevOps Setup | Deployed |
| P0 (MVP) | PROJ-4: Workspace & Membership | Deployed |
| P0 (MVP) | PROJ-5: Niche List | Deployed |
| P0 (MVP) | PROJ-6: Niche Deep Research (LangGraph) | Ready to Deploy |
| P0 (MVP) | PROJ-7: Amazon Product Research | In Progress |
| P0 (MVP) | PROJ-8: Idea & Slogan Generation (LangGraph) | In Review |
| P0 (MVP) | PROJ-9: Design Generation + Post-Processing (OpenRouter) | In Progress |
| P1 | PROJ-10: Keyword Research & Bank (JungleScout) | In Progress |
| P0 (MVP) | PROJ-11: Publish (Listing + Upload Manager) | In Progress |
| P1 | PROJ-12: Dashboard & Analytics | In Progress |
| P1 | PROJ-13: Desktop Upload App (Electron + Playwright) | In Progress |
| P1 | PROJ-14: Team Kanban & Collaboration | In Progress |
| P0 (MVP) | PROJ-15: Vector Database (AI Memory — pgvector) | In Progress |
| P0 (MVP) | PROJ-16: Amazon Product Scraper (Scrapy) | In Review |
| P0 (MVP) | PROJ-17: Deep Web Search (Vane + Crawl4ai) | Planned |
| P0 (MVP) | PROJ-18: OpenClaw Agent (LangGraph Multi-Agent) | In Progress |
| P1 | PROJ-19: Global Cloud Picker (OneDrive + Google Drive) | Planned |
| P0 (MVP) | PROJ-20: Chat UX Perplexity-Parity | In Review |
| P1 (Post-MVP) | PROJ-21: Chat Attachments + Document RAG + Agentic Tool-Use | Deferred |
| P0 (MVP) | PROJ-22: Server-Migration auf VC 8-32 + Mono-Repo Infrastruktur | Planned |
| P0 (MVP) | PROJ-24: Legal Pages + Global Footer + Feature Flag System | Planned |
| P0 (MVP) | PROJ-25: Bulk ASIN One-Shot Scrape Batches | Planned |
| P0 (MVP) | PROJ-27: AI Upscaler (Single + Bulk via Replicate) | In Review |
| P0 (MVP) | PROJ-28: Niche Research Product Limit | Planned |
| P0 (MVP) | PROJ-29: Niche-Data Agentic RAG + Configurable Prompts + Langfuse | In Review |
| P0 (MVP) | PROJ-30: App-wide Responsive Design (iPhone SE / iPad / MacBook) | Planned |

## Success Metrics

- **Activation:** User completes full pipeline (research → design → listing) within first session
- **Retention:** Weekly active workspaces after 30 days
- **Pipeline throughput:** Listings published per workspace per week
- **Time-to-listing:** Average time from niche creation to listing-ready state
- **Design acceptance rate:** % of AI-generated designs approved without regeneration

## Constraints

- Small team; backend auth deployed; LangGraph workflows operational for niche research (PROJ-6)
- Django + Supabase PostgreSQL shared instance (Django owns schema via migrations)
- n8n workflows fully migrated to LangGraph (PROJ-6, PROJ-8) — no n8n runtime dependency
- OpenRouter API key must be rotated before PROJ-9 (currently in n8n workflow JSON in git)
- Workspace isolation enforced at ORM level on every protected endpoint
- Multiple django-rq workers: `worker-research`, `worker-slogan`, `worker-design`, `worker-agent`
- External services in localai-stack: SearXNG, Vane (Perplexica), Crawl4ai, Supabase PG
- Langfuse for LLM observability (all LangGraph workflows)

## Non-Goals (MVP)

- Mobile app (iOS/Android)
- Multi-marketplace support beyond Amazon (Redbubble, Teepublic, etc.)
- Billing / subscription management (Polar.sh integration deferred to post-MVP)
- Real-time board updates via WebSocket on Kanban (manual refresh for MVP)
- Google Trends live integration
- Real-ESRGAN GPU-based upscaling (external API used instead for MVP)
- Agent-to-Agent cross-workspace communication
- Voice commands
- Browser Push Notifications / Email Digests (In-App only for MVP)
