# PROJ-22: Server-Migration auf VC 8-32 + Mono-Repo Infrastruktur

**Status:** Planned
**Priority:** P0 (Infrastructure — blockiert PROJ-21 RAG)
**Created:** 2026-04-28
**Last Updated:** 2026-04-28

## Overview

Migration von Strato VPS VC4-8 (4 vCPU, 8 GB RAM, €15/mo) auf **VC 8-32** (8 vCPU, 32 GB RAM, 480 GB SSD, €20/mo regular / €1/mo Promo erste 3 Monate). Aktueller Server hat 92% RAM-Auslastung, kein Swap, ist heute (2026-04-28) während Vane-Build komplett abgestürzt — Trigger für diese Migration.

Parallel: **Mono-Repo-Restrukturierung** der merch-miner-spezifischen Infrastruktur. Vane (mit unserem PR #1118 Patch) + SearXNG + Crawl4ai wandern aus `/home/dev/local-ai-packaged/` in das merch-miner-Repo unter `infra/`. **Shared Infrastruktur (Supabase, Langfuse, n8n, Caddy) bleibt im localai-stack-Repo** — das ist Cross-Project (auch für künftige Projekte).

Migration via Branch `feat/PROJ-22-server-migration` — purely additive (existing app code unverändert, alter Server läuft weiter bis Cutover). Soft cutover mit 1-2 Wochen Parallel-Run für Rollback-Sicherheit.

## Dependencies

- PROJ-17 (Vane + Crawl4ai) — wir migrieren ihre Configs ins merch-miner-Repo
- PROJ-21 (Chat Attachments + RAG) — blockiert auf 16+ GB RAM (BGE-Reranker), VC 8-32 löst das
- KEINE Code-Dependencies; rein Infrastruktur

## User Stories

1. As an operator, I want a fresh server bootstrap to take ≤30 minutes from "Strato bestellt" to "all services up", so I can recover from disaster fast.
2. As an operator, I want a single `git clone merch-miner && docker compose up` to run all merch-miner-specific services, so deployment is reproducible.
3. As an operator, I want shared infra (Supabase, Langfuse, n8n) to stay in `localai-stack` repo, so I can reuse it for future non-merch-miner projects.
4. As an operator, I want pg_dump-based data migration (NOT volume-copy), so I'm safe from Postgres-version-mismatches and macOS↔Linux portability issues.
5. As an operator, I want both servers to run in parallel for 1-2 weeks after cutover, so I have a rollback path if data integrity issues surface.
6. As an operator, I want PR #1118 Vane custom-build documented in the repo, so I can reproduce it on the new server.
7. As a developer, I want git-tagged checkpoints (`v-pre-migration`, `v-post-migration`), so I can reference exact versions during incident-response.

## Acceptance Criteria

### Phase 1 — Branch + Mono-Repo-Strukturierung

- [ ] AC-1: Branch `feat/PROJ-22-server-migration` aus `main` erstellt. Alle Phase-1+2-Arbeit landet hier — `main` bleibt unbroken.
- [ ] AC-2: `infra/` Verzeichnis im merch-miner-Repo angelegt mit Subdirs:
  - `infra/vane/config.toml` (kopiert von `/home/dev/local-ai-packaged/vane/config.toml`)
  - `infra/vane/setup-providers.sh` (re-register OpenRouter via API — siehe `memory/project_vane_custom_build.md`)
  - `infra/vane/Dockerfile.pr-1118` (eigenes Build-Recipe falls upstream PR #1118 nicht merged ist beim Migrations-Zeitpunkt)
  - `infra/vane/README.md`
  - `infra/searxng/settings.yml`
  - `infra/crawl4ai/config.yaml` (falls vorhanden in current setup)
- [ ] AC-3: `docker-compose.infra.yml` im Repo-Root, definiert Vane + SearXNG + Crawl4ai Services. Network-bridge zu `localai_default` damit Communication mit Supabase + Caddy funktioniert.
- [ ] AC-4: `docker-compose.yml` (existing app-stack) bleibt unverändert. Production-Run nutzt: `docker compose -f docker-compose.yml -f docker-compose.infra.yml -f docker-compose.prod.yml up -d`.
- [ ] AC-5: `docs/infrastructure.md` dokumentiert komplette Architektur: localai-stack vs merch-miner Trennung, Network-Bridges, Volume-Locations, Recovery-Steps.

### Phase 2 — Bootstrap + Migration Scripts

- [ ] AC-6: `scripts/bootstrap-server.sh` — vollautomatisches Setup für fresh Strato-VPS:
  - SSH-Key validation
  - Swap-File 4GB (essential auf 32GB-System für safety net)
  - Docker + docker compose v2 installation
  - UFW firewall (22, 80, 443, optional dev-ports gated by env)
  - Git-clone beide Repos (`merch-miner` + `local-ai-packaged`)
  - Prompt für `.env` (interactive) ODER copy von secrets-vault
  - `docker compose up -d` für beide Stacks
  - Health-checks
- [ ] AC-7: `scripts/migrate-data.sh` — Daten-Transfer alt → neu:
  - `pg_dump` aller relevanten DBs auf altem Server: `merch_miner` (app), `langfuse`, `supabase_*`
  - `tar czf media.tar.gz django-app/media/` für File-Storage
  - `rsync -avz` der dumps + tarballs zum neuen Server
  - `pg_restore` auf neuem Server
  - `tar xzf` + permission fix für media
  - Integrity-checks (row-counts compared, file-counts compared)
- [ ] AC-8: `scripts/cutover.sh` — kurzer geplanter Switch:
  - Stoppe Write-Services auf altem Server (web, worker)
  - Final-Delta `pg_dump` der letzten 5-30 min
  - Apply auf neuem Server
  - DNS / SSH-Tunnel umstellen (lokales `scripts/dev-tunnel.sh` SERVER_HOST update)
  - Smoke-Test
- [ ] AC-9: Alle Scripts idempotent (re-runnable ohne Damage), klare Fehler-Output, Exit-Codes.

### Phase 3 — Server-Setup + Test

- [ ] AC-10: Strato VC 8-32 bestellt mit €1-Promo. SSH-Zugang konfiguriert.
- [ ] AC-11: `bootstrap-server.sh` auf neuem Server ausgeführt — Stack hochgefahren mit leeren DBs.
- [ ] AC-12: Smoke-Test mit leeren DBs:
  - localai-stack: Supabase, Langfuse, Caddy reachable
  - merch-miner: web (`/api/auth/me/`) responsive, frontend lädt, Vane health-check ok
- [ ] AC-13: Vane PR #1118 Provider-Setup via `infra/vane/setup-providers.sh`:
  - OpenRouter via `/api/providers` registriert
  - Models hinzugefügt
  - Test-Search erfolgreich (research query, kein Crash)

### Phase 4 — Daten-Migration

- [ ] AC-14: `migrate-data.sh` auf altem Server gestartet — alle DBs dumped + transferiert
- [ ] AC-15: Integrity-Checks PASS:
  - `merch_miner.user_auth_app_user` row count alt = neu
  - `merch_miner.niche_app_niche` row count alt = neu
  - `merch_miner.search_app_chatsession` row count alt = neu
  - `media/` file count alt = neu
  - Random-Sample 5 Records: deep-equal alt = neu
- [ ] AC-16: Test-User-Login auf neuem Server erfolgreich (mariowinter.sg@gmail.com)
- [ ] AC-17: Niches-List + Chat-History sichtbar wie auf altem Server

### Phase 5 — Soft Cutover

- [ ] AC-18: Lokales `scripts/dev-tunnel.sh` `SERVER_HOST` auf neue IP umgestellt — Mac sees neuen Server
- [ ] AC-19: `frontend-ui/.env.production` aktualisiert (falls API-URL hardcoded)
- [ ] AC-20: `cutover.sh` auf altem Server ausgeführt: Final-Delta-Sync + DNS-Update
- [ ] AC-21: Alter Server bleibt **read-only running** für 1-2 Wochen (Rollback-Backup)
- [ ] AC-22: Post-Cutover Smoke-Test komplett: alle UI-Pfade funktional auf neuem Server

### Phase 6 — Cleanup

- [ ] AC-23: Git-Tag `v-pre-migration` auf alten `main`-HEAD setzen (vor Branch-Merge) für Rollback-Reference
- [ ] AC-24: Branch `feat/PROJ-22-server-migration` in `main` mergen (squash oder merge-commit, je nach Präferenz)
- [ ] AC-25: Git-Tag `v-post-migration` auf neuem `main`-HEAD setzen
- [ ] AC-26: `MEMORY.md` updaten — neuen Server-IP, alte Migration-Memory entfernen
- [ ] AC-27: `scripts/dev-tunnel.sh` final auf neue IP commited
- [ ] AC-28: Nach 1-2 Wochen erfolgreichem Run: alter Server bei Strato kündigen
- [ ] AC-29: `MEMORY.md` "Vane Custom Build PR #1118" Eintrag aktualisieren oder entfernen falls PR upstream gemerged wurde während Migration

## Edge Cases

- [ ] EC-1: Strato VC 8-32 hat kein Promo mehr beim Bestellen → fallback auf €20/mo regular oder VC 12-48 (€30/mo) anbieten.
- [ ] EC-2: PR #1118 wird upstream merged während Phase 1-3 läuft → switch von Custom-Build auf `vane:latest`. Memory-Entry "Vane Custom Build" deprecated.
- [ ] EC-3: `pg_dump` während aktiver Writes auf altem Server → leichte Inkonsistenz möglich. Mitigation: Wartungsfenster mit `web` + `worker` gestoppt für Final-Dump.
- [ ] EC-4: Network-Bridge zwischen localai-stack-Network und merch-miner-Network nicht funktional → Fallback: alle Services in `localai_default` Network (existing pattern).
- [ ] EC-5: Neue Server-IP ist anderer geographischer Standort → Latenz-Increase. Mitigation: Strato VC-Server alle in DE-Datacenter, sollte minimal sein.
- [ ] EC-6: Caddy Domain-Setup (langfuse.mariowinter.com etc.) auf altem Server, neuer Server hat noch keine Domain → DNS Cutover-Step umfasst neue A-Records ODER kurzer Domain-Reuse downtime.
- [ ] EC-7: User-uploaded Files (designs, attachments later) sind groß (>10 GB) → rsync braucht Stunden. Mitigation: rsync mehrfach incremental, finaler Sync nur Delta.
- [ ] EC-8: Datenbank-Versionen unterschiedlich (alt = pg14, neu = pg16) → `pg_dump --format=custom` + `pg_restore` handled cross-version. Volume-Copy würde scheitern.
- [ ] EC-9: SSH-Tunnel-Script auf User's Mac muss aktualisiert werden bei Cutover → in `dev-tunnel.sh` SERVER_HOST als ENV-var, nicht hardcoded.
- [ ] EC-10: Während Soft-Cutover schreibt User auf altem Server → Daten gehen verloren (read-only-claim ist cosmetic). Mitigation: Vor Cutover klar kommunizieren "ab jetzt nur noch neuer Server".

## Technical Requirements

- **Performance:**
  - Bootstrap-Script ≤ 30 min on fresh Strato VC 8-32
  - Daten-Migration: pg_dump + rsync + restore ≤ 4h für 50 GB DBs
  - Cutover-Downtime: ≤ 5 min
- **Server (target VC 8-32):**
  - 8 vCPU, 32 GB RAM, 480 GB SSD
  - 4 GB Swap-File konfiguriert (Safety-Net auch bei viel RAM)
  - UFW-Firewall: 22, 80, 443 + dev-ports gated
- **Backup-Strategie nach Migration:**
  - Alter Server min. 2 Wochen running (read-only after cutover)
  - Daily pg_dump auf neuem Server zu separatem Backup-Volume
- **Test-Strategy:**
  - Smoke-Test komplette UI-Pfade nach jeder Phase
  - Data-Integrity-Checks zwischen Migration-Phasen

## Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Strato VC 8-32 (€20/mo, €1 Promo 3 Mo) | 4× current RAM, ausreichend für PROJ-21 RAG + 2 Jahre Wachstum, sehr gutes Preis-Leistung vs Hetzner |
| 2 | Soft Cutover (parallel run 1-2 Wochen) | Rollback-Sicherheit > €15/mo Doppel-Cost. Single-Dev kann sich keine schwierigen Rollbacks leisten |
| 3 | Hybrid: localai-stack bleibt separat, merch-miner bekommt Vane/SearXNG/Crawl4ai | Vane/Crawl4ai sind merch-miner-dedicated (mit PR #1118 Patch). n8n/Langfuse/Supabase shared infra für ggf. künftige Projekte |
| 4 | pg_dump + rsync + pg_restore (NICHT Volume-Copy) | Cross-Version-safe, transparent, transformierbar (z.B. anonymize beim Test). Volume-Copy ist macOS↔Linux-incompatible falls user später lokal teste |
| 5 | Vollautomatisches bootstrap-server.sh | Wenn Migration in Zukunft wiederholt wird (Disaster Recovery / weitere Tier-Upgrades), 10 min statt Stunden |
| 6 | Branch `feat/PROJ-22-server-migration` purely additive | Alter Server läuft weiter auf `main` während Migration. Hotfixes auf main werden ggf. in Branch rebased |
| 7 | Git-Tags `v-pre-migration` + `v-post-migration` | Eindeutige Rollback-Punkte, einfach in Incident-Response |
| 8 | Vane custom-build (PR #1118) wird gleich von Anfang an mitmigriert | Aktuell auf altem Server gerade gebaut. Bauen auf neuem Server analog. Falls PR merged: switch zu `vane:latest` |

## Out of Scope (deferred)

- **DNS-Provider-Wechsel** — bleibt wie heute (Caddy regelt's, falls Domain-Provider gewechselt wird ist das eigene Aufgabe)
- **ScrapeOps-Konfiguration für 600k ASINs** — separate Aufgabe (eigene Spec falls nötig)
- **Multi-Server / Staging Environment** — VC 8-32 = Production-only. Staging später wenn nötig
- **Ansible / Terraform** — Bash-Scripts reichen für Single-Server-Setup. Ansible falls je multiple-server
- **Backup auf externes System** (S3 etc.) — local Daily-Dumps reichen für MVP. External Backup separat
- **Monitoring/Alerting** (Grafana, Prometheus, etc.) — out of scope; manueller `htop`/`docker stats` reicht aktuell

## Verification Steps

1. Strato VC 8-32 bestellt + SSH-key uploadet → ssh root@new-ip funktioniert
2. `bootstrap-server.sh` durchläuft ohne Error, alle Container `Up`
3. Smoke-Test: User-Login, Niche-List, Chat-Send (mit Vane working) auf neuem Server
4. `migrate-data.sh` läuft durch, integrity-checks PASS
5. Cutover: tunnel + .env.production auf neue IP, alter Server gestoppt → app responsive auf neuem
6. 1 Woche aktive Nutzung ohne Issues → alter Server kündigen

---

<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)
_To be added by /architecture_

## QA Test Results
_To be added by /qa_

## Deployment
_To be added by /deploy_
