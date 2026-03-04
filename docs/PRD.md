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
| P0 (MVP) | PROJ-3: CI/CD & DevOps Setup | Planned |
| P0 (MVP) | PROJ-4: Workspace & Membership | Planned |
| P0 (MVP) | PROJ-5: Niche List | Planned |
| P0 (MVP) | PROJ-6: Niche Deep Research (n8n) | Planned |
| P0 (MVP) | PROJ-7: Amazon Product Research | Planned |
| P0 (MVP) | PROJ-8: Idea & Slogan Generation (n8n) | Planned |
| P0 (MVP) | PROJ-9: Design Generation (OpenRouter) | Planned |
| P1 | PROJ-10: Niche Keyword Bank | Planned |
| P0 (MVP) | PROJ-11: Listing & Keyword Generator | Planned |
| P1 | PROJ-12: Dashboard | Planned |
| P1 | PROJ-13: Marketplace Upload Manager (MBA Automation — Selenium) | Planned |
| P1 | PROJ-14: Team Kanban | Planned |
| P2 | PROJ-15: Analytics & Reporting | Planned |
| P2 | PROJ-16: Amazon Product Scraper (Scrapy) | Planned |
| P0 (MVP) | PROJ-17: Docker Restructure (Root Compose, Frontend Container, Caddy Fix) | Planned |

## Success Metrics

- **Activation:** User completes full pipeline (research → design → listing) within first session
- **Retention:** Weekly active workspaces after 30 days
- **Pipeline throughput:** Listings published per workspace per week
- **Time-to-listing:** Average time from niche creation to listing-ready state
- **Design acceptance rate:** % of AI-generated designs approved without regeneration

## Constraints

- Small team; backend auth already built; n8n workflows for niche research and slogan generation already exist
- n8n webhook URLs and auth method not yet confirmed
- n8n + Django share same Supabase PostgreSQL instance (n8n must be granted INSERT on Django-managed tables)
- n8n slogan workflow currently writes to Google Sheets — must migrate to Supabase PG before PROJ-8
- OpenRouter API key is currently hardcoded in n8n workflow JSON committed to git — must rotate before PROJ-9
- No `worker` service in docker-compose yet (needed for PROJ-9 design generation via django-rq)
- Workspace isolation must be enforced at ORM level on every protected endpoint

## Non-Goals (MVP)

- LangChain / LangGraph agent migration
- Mobile app (iOS/Android)
- Multi-marketplace support beyond Amazon (Redbubble, Teepublic, etc.)
- Billing / subscription management (Polar.sh integration deferred to post-MVP)
- Real-time collaboration (Supabase Realtime / WebSocket notifications)
- Google Trends live integration
- Scrapy-based scraper (PROJ-16 is P2; n8n + ScraperOps handles scraping for MVP)
- pgvector semantic search (future enhancement)
- Real-time WebSocket push for job status (polling used instead)
