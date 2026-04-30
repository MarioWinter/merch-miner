# PROJ-22: Server-Migration auf VC 8-32 + Mono-Repo Infrastruktur

**Status:** In Progress
**Priority:** P0 (Infrastructure — blockiert PROJ-21 RAG)
**Created:** 2026-04-28
**Last Updated:** 2026-04-30 — Server-Inventur durchgeführt + Migrations-Entscheidungen finalisiert (siehe "Pre-Migration-Inventur 2026-04-30" + Decisions Log #9-#14)

## Overview

Migration von Strato VPS VC4-8 (4 vCPU, 8 GB RAM, €15/mo) auf **VC 8-32** (8 vCPU, 32 GB RAM, 480 GB SSD, €20/mo regular / €1/mo Promo erste 3 Monate). Aktueller Server hat 92% RAM-Auslastung, kein Swap, ist heute (2026-04-28) während Vane-Build komplett abgestürzt — Trigger für diese Migration.

Parallel: **Mono-Repo-Restrukturierung** der merch-miner-spezifischen Infrastruktur. Vane (mit unserem PR #1118 Patch) + SearXNG + Crawl4ai wandern aus `/home/dev/local-ai-packaged/` in das merch-miner-Repo unter `infra/`. **Shared Infrastruktur (Supabase, Langfuse, n8n, Caddy) bleibt im localai-stack-Repo** — das ist Cross-Project (auch für künftige Projekte).

Migration via Branch `feat/PROJ-22-server-migration` — purely additive (existing app code unverändert, alter Server läuft weiter bis Cutover). Soft cutover mit 1-2 Wochen Parallel-Run für Rollback-Sicherheit.

## Pre-Migration-Inventur (2026-04-30)

### Alter Server `213.165.95.5` (Strato VC4-8)
- **OS:** Ubuntu 24.04.4 LTS · **Hostname:** `ubuntu` · **Docker:** 29.3.0
- **RAM:** 7.7 GB total / 6.7 GB used (am Limit, kein Swap)
- **Disk:** 232 GB / 75% voll (`/var/lib/docker` = 175 GB → primarily Langfuse ClickHouse + Supabase logs)
- **Repos in `/home/dev/`:** `merch-miner/` (5 MB, branch `main`, alles committed), `local-ai-packaged/`, `self-hosting-ai-winterkit/` (NICHT migrieren), `videoflix-backend-main/` (NICHT migrieren), `backups/`
- **33 Container running** — 8 merch-miner (`app_*`), 25 localai-stack (Supabase 12, Langfuse 4, n8n, Vane, Crawl4ai, SearXNG, Caddy, Redis, MinIO, ClickHouse)
- **⚠️ Probleme:** `supabase-storage` + `supabase-pooler` im Restart-Loop (RAM-Pressure)
- **App-Daten in `merch_miner` schema:** 1 User, 1 Niche, 1 Workspace, AmazonProducts ~1.4 MB → Test/Dev-Daten, kein Production-Volumen
- **Postgres-Instanzen:** `supabase-db` (postgres:15.8) → `_supabase` 2.1 GB (Vector-Embeddings + Langfuse) + `merch_miner` schema. `localai-postgres-1` (postgres:17) für Langfuse separat.
- **Caddy-Domains:** `miner.mariowinter.com` → backend (web:8000), `merch-miner.mariowinter.com` → frontend, plus localai-stack Subdomains (`langfuse.*`, `searxng.*`, n8n etc.)
- **Docker-Images:** Pulled von `ghcr.io/mariowinter/merch-miner/{backend,frontend}:latest` (CI/CD-Pipeline pusht dort)

### Neuer Server `212.132.102.96` (Strato VC 8-32)
- **OS:** Ubuntu 24.04.4 LTS · **Hostname:** `ubuntu` (wird zu `merch-miner` umbenannt)
- **RAM:** 31 GB total / 690 MB used · **Kein Swap** (wird konfiguriert)
- **Disk:** 464 GB SSD / 1% used (2.2 GB) — fully blank
- **CPU:** 8 vCPU
- **Vorinstalliert:** git, curl, wget, rsync, ufw (inactive), vim, htop
- **Fehlt:** Docker, docker-compose, autossh
- **Verzeichnisse `/srv` + `/opt` + `/home`** alle leer
- **Nur root user** — `dev` User existiert nicht
- **UFW** binary present aber nicht aktiv

## Migration-Entscheidungen (finalisiert 2026-04-30)

| Entscheidung | Wert | Begründung |
|--------------|------|------------|
| Verzeichnis-Konvention | `/srv/merch-miner/` + `/srv/local-ai-packaged/` | FHS-Standard, sauber von `/home` getrennt, single backup mount-point |
| Hostname (neu) | `merch-miner` | Disambiguierung vs. altem `ubuntu`-Host in Logs/SSH-Prompts |
| User-Strategie | Root-only, gehärtet (SSH key-only, no PasswordAuth, UFW) | Solo-Dev-Setup, dev-User-Komplexität bringt nur Wert bei Multi-User-SSH |
| Migrations-Scope | NUR `merch-miner` + `local-ai-packaged` | `self-hosting-ai-winterkit` (alte Version) + `videoflix-backend-main` (fremdes Projekt) bleiben auf altem Server zurück bzw. werden nicht mehr betrieben |
| DB-Strategie | Kompletter `pg_dump` aller relevanten DBs | Saubere Reproduktion inkl. Vector-Embeddings, kein "frisch neu generieren" |
| Migrations-Modus | Schritt-für-Schritt mit User-Approval pro Phase | Volle Kontrolle, jederzeit Rollback |

## Migrations-Strategie (finalisiert 2026-04-30)

**Code-Stand:** Neuer Server bekommt 1:1 den Stand vom alten Server (= `main` Branch = Commit `4552aa4`, Docker Images von GHCR `:latest` aus diesem Commit). PROJ-15 / PROJ-16 / PROJ-18 (alle aktuell auf `feature/create-new-features` mit ~22 Commits Vorsprung) werden **NICHT** im Rahmen der Migration deployed. Diese kommen erst später nach abgeschlossener Feature-Entwicklung via normalem PR → main → CI/CD-Build → `docker compose pull` auf neuem Server.

**Migrations-Tools-Persistenz (Option Z):** Bootstrap-Script + Migration-Scripts leben **lokal auf dem Mac** unter `/Users/mariomuller/dev/merch-miner/scripts/migration/` (gitignored). Sie werden per `scp`/`rsync` direkt auf den neuen Server transferiert wenn benötigt. Begründung: keine Verschmutzung des `main`-Branch (der dem Server-Stand entsprechen muss); keine Verschmutzung des feature-Branch mit Infra-Tooling; nach erfolgreicher Migration können sie ggf. später als separater PR ins Repo wandern.

**Repos auf neuem Server:**
- `merch-miner` → `git clone https://github.com/MarioWinter/merch-miner.git /srv/merch-miner` (via neuem Deploy-Key)
- `local-ai-packaged` → `git clone <github-url> /srv/local-ai-packaged` (via neuem Deploy-Key, URL beim Phase-0-Check ermitteln)
- Branch auf beiden: `main` (= alter Server-Stand)

**Sensitive Files via SSH-Transfer (NICHT in Git):**
- `/home/dev/merch-miner/.env` → `/srv/merch-miner/.env` (rsync)
- `/home/dev/local-ai-packaged/.env` → `/srv/local-ai-packaged/.env` (rsync) — **kritisch**: enthält `N8N_ENCRYPTION_KEY`, ohne den n8n alle gespeicherten Credentials nicht mehr entschlüsseln kann
- Vane custom-build PR #1118 patches (falls außerhalb Repo)

**Daten via SSH-Streaming:**
- Postgres: `pg_dump --format=custom` auf altem Server | `pg_restore` auf neuem Server (gestreamt durch SSH)
- ClickHouse (Langfuse Events): entweder `clickhouse-backup` Tool oder Volume-rsync
- MinIO storage (Langfuse Media): Volume-rsync
- App-Volumes (`django-app_media_volume` = 4 KB, `django-app_caddy_data` = TLS certs): rsync
- **TLS-Certs Strategie:** Caddy-Volume `caddy_data` per rsync mitnehmen → existing Let's Encrypt Certs werden übernommen → umgeht LE Rate-Limit (5/Domain/Woche)

**SSH-Deploy-Key Strategie:**
- Auf neuem Server NEUEN Key generieren: `ssh-keygen -t ed25519 -C "merch-miner-prod-deploy" -f /root/.ssh/github_deploy`
- Public Key zeigen → User fügt manuell bei GitHub als Deploy-Key in beiden Repos ein
- Read-only reicht für `git pull` (kein push vom Server aus)

**DNS-Strategie:**
- DNS-Records werden vom User manuell beim Provider umgestellt (out of automation scope)
- 24h vor Cutover: TTL aller relevanten Records auf 300s setzen → schneller Switch
- Zu ändernde Records nach Phase 0 als komplette Liste an User übergeben

**Wartungsfenster:** Flexibel, kein Zeitdruck. Soft-Cutover mit 1-2 Wochen Parallel-Run für Rollback-Sicherheit.

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
- [ ] AC-2: `infra/` Verzeichnis im merch-miner-Repo angelegt mit Subdirs (Configs werden vom alten Server `213.165.95.5:/home/dev/local-ai-packaged/` per `scp`/`rsync` kopiert):
  - `infra/vane/config.toml`
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
  - SSH-Key validation (key bereits hochgeladen via Strato-Panel oder per `ssh-copy-id`)
  - Hostname auf `merch-miner` setzen (`hostnamectl set-hostname merch-miner`)
  - Swap-File 4GB (essential auf 32GB-System für safety net)
  - Docker + docker compose v2 installation (offizielles Repo)
  - SSH-Hardening: `PasswordAuthentication no`, `PermitRootLogin prohibit-password`
  - UFW firewall enable (22, 80, 443, optional dev-ports gated by env)
  - Verzeichnis-Setup: `mkdir -p /srv/merch-miner /srv/local-ai-packaged`
  - Git-clone beide Repos in `/srv/`
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
| 9 | Verzeichnis-Konvention `/srv/merch-miner/` + `/srv/local-ai-packaged/` | FHS-Standard für Service-Daten. Sauberer als alter `/home/dev/...` Pfad. Single backup mount-point. (Entscheidung 2026-04-30) |
| 10 | Hostname `merch-miner` (nicht `mm-prod-01`) | User-Präferenz. Klar, eindeutig, keine Abkürzung. Wird via `hostnamectl set-hostname` gesetzt. |
| 11 | Root-only User-Strategie (kein dev-User) | Solo-Dev-Setup. SSH-key-only + `PasswordAuthentication no` + `PermitRootLogin prohibit-password` + UFW = ausreichendes Härtungs-Niveau. Dev-User-Komplexität nur bei Multi-User-SSH wertvoll. |
| 12 | NUR `merch-miner` + `local-ai-packaged` migrieren | `self-hosting-ai-winterkit` ist alte localai-Version (deprecated), `videoflix-backend-main` ist fremdes Projekt — beide bleiben auf altem Server zurück oder werden nicht mehr betrieben. |
| 13 | Kompletter `pg_dump` ALLER DBs (auch `_supabase` 2.1 GB inkl. Vector-Embeddings) | Saubere 1:1-Reproduktion. Kein "Embeddings frisch generieren" → spart LLM-API-Kosten und Rebuild-Zeit. |
| 14 | Schritt-für-Schritt-Modus mit User-Approval pro Phase | Volle Kontrolle, jederzeit Rollback. Autonome Ausführung verworfen. |
| 15 | Migration findet auf `feature/create-new-features` Branch statt, KEINE Änderung an `main` | `main` muss exakt dem alten-Server-Stand entsprechen (= Code den der neue Server clont). Migrations-Tools nicht in main → kein Code-Drift. |
| 16 | Migrations-Scripts lokal auf Mac (Option Z), gitignored | Migrations-Tooling gehört nicht in den Production-Code. Saubere Trennung. Kann später optional separat ins Repo wandern. |
| 17 | Caddy `caddy_data` Volume per rsync mitnehmen | Existing Let's Encrypt Certs auf neuem Server wiederverwenden → umgeht LE Rate-Limit (5 Certs/Domain/Woche). Certs sind domain-bound, nicht IP-bound. |
| 18 | Neuer SSH-Deploy-Key auf neuem Server (kein Key-Transfer vom alten) | Best Practice: keine Key-Wiederverwendung über Server hinweg. User trägt Public-Key bei GitHub manuell als Deploy-Key in beiden Repos ein. |
| 19 | `.env` Files (inkl. `N8N_ENCRYPTION_KEY`) per rsync vom alten Server | n8n-Credentials sind verschlüsselt mit `N8N_ENCRYPTION_KEY` in DB → ohne Key-Transfer wären alle gespeicherten n8n-Credentials nach Migration unbrauchbar. |
| 20 | Code-Stand der Migration = `main` (4552aa4), NICHT `feature/create-new-features` | Saubere 1:1 Migration. PROJ-15/16/18 später separat deployen via normalem CI/CD-Flow nach Feature-Abschluss. |

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
