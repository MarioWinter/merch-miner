# Architecture Decisions

Cross-cutting architectural patterns. Add a new entry per major decision — keep individual entries short, link out to feature specs for detail.

---

## ADR-001: 2-Layer Access Control (Entitlements + Permissions)

**Date:** 2026-05-01 (revised 2026-05-15 in PROJ-31)
**Status:** Decided (Entitlements = PROJ-31 shipped; build-time Feature Flags removed; Polar.sh subscription = PROJ-32; per-tier credit-limits = future PROJ; Lean MVP analytics = PROJ-33)
**Context:** Original ADR (2026-05-01) had 3 layers including build-time `VITE_FF_*` flags. PROJ-31 (2026-05-15) collapsed to 2 layers because the build-time flag layer was never used effectively — all gating concerns (staff-only beta, paid tier, etc.) can run through the runtime entitlement layer. Single pre-auth case (REGISTRATION_ENABLED) kept as one minimal ENV helper.

### The 2 Layers

Two independent concerns, complementary, NOT interchangeable:

| Layer | Question | Source of Truth | When |
|---|---|---|---|
| **Entitlement** | "Hat dieser User Zugriff auf Feature X?" (tier + role + staff) | `core/entitlements.resolve_features(user)` → `/api/auth/me/` payload `features: [...]` | Shipping (PROJ-31) |
| **Permission** | "Darf dieser User diese Action auf diese Resource?" | DRF `permission_classes` per endpoint | Per Feature-Spec |

Single special case: `isRegistrationEnabled()` reads `VITE_ENABLE_REGISTRATION` ENV at build-time — required because registration UI fires BEFORE login (no user → no entitlement resolution possible).

### Beispiel Cloud Storage (PROJ-9/11)

1. **Flag** `CLOUD_STORAGE_ENABLED=true` → Feature ist gebaut, ausgerollt, alle User sehen es
2. **Entitlement** `cloud_storage in user.subscription.features` → User hat PRO-Tier (zukünftig)
3. **Permission** `IsWorkspaceMember` → User darf in DIESEM Workspace OneDrive verbinden

### Frontend-API für jede Schicht

```ts
useFeatureFlag(FEATURE_FLAGS.CLOUD_STORAGE_ENABLED)   // build-time + admin override
useEntitlement('cloud_storage')                       // user-tier (post-MVP)
// Permissions werden vom Backend enforced — Frontend muss nur 403/402 sauber handeln
```

### Tier → Capabilities Mapping (Best Practice)

Wenn Subscription-System kommt: **NICHT** `if (tier === 'PRO')` im Code verstreuen. Stattdessen:

```python
# Backend single source of truth
TIER_CAPABILITIES = {
    'FREE': {'features': ['niche_research'], 'limits': {'niches_per_month': 5}},
    'PRO': {'features': ['niche_research', 'cloud_storage', 'kanban'], 'limits': {'niches_per_month': 100}},
    'BUSINESS': {'features': ['*'], 'limits': {'niches_per_month': None}},
}
```

`/api/auth/me/` liefert **fertig aufgelöste** `subscription.features: [...]` ans Frontend → Frontend kennt Tier-Mapping nicht. Ändert sich Tier-Definition, ändert sich nur eine Datei.

### Frontend-Patterns für Paywalled Features

| Pattern | Wann |
|---|---|
| **Hide** | Features die kein Sinn machen für Tier (Admin-only Stuff) — keine Conversion |
| **Disable + Tooltip "Upgrade to unlock"** | Buttons in bestehenden Flows — subtil |
| **Show-with-Paywall** (Recommended für Tier-Hauptfeatures) | Wrapper-Component zeigt Upgrade-CTA statt Children — beste Conversion |

```tsx
<PaywallGate feature="cloud_storage" requiredTier="PRO">
  <CloudStorageButton />
</PaywallGate>
```

Limit-Counter UI (`47/100 niches used`) für Free-Tier-Friction.

### Migrationspfad: Feature Flag → Entitlement

Wenn Polar.sh-Integration kommt:
1. Eigenes Feature (PROJ-XX) für Subscription-Setup (Webhooks, `Subscription`-Model, `/me/`-Erweiterung)
2. Neuer Hook `useEntitlement(feature)` parallel zu `useFeatureFlag` — gleiche Signatur, andere Quelle
3. Refactor: Build-time Flags die jetzt nur "Feature noch nicht ready" markieren bleiben Flags. Flags die zu Tier-Gates werden (z.B. `KANBAN_ENABLED` wenn Kanban PRO-only) → Migration zu Entitlement
4. Permissions bleiben unverändert — sind unabhängige Schicht

### Was NICHT zu tun

- ❌ Feature Flag als Security-Boundary nutzen (Client-side, manipulierbar)
- ❌ Tier-Strings hardcoded im Frontend (`if (tier === 'PRO')`) statt Capability-Check
- ❌ Permissions im Frontend "ersetzen" — Backend-Enforcement ist nicht verhandelbar
- ❌ Hidden Paywalled Features (kein Upgrade-Pfad sichtbar = 0 Conversion)

### Referenzen

- PROJ-24 — Feature Flag System (current frontend-only)
- PRD `docs/PRD.md` — Polar.sh als Post-MVP
- DRF Permissions: https://www.django-rest-framework.org/api-guide/permissions/
- Industry: Stripe Customer Portal, Linear/Notion/Figma nutzen alle dieses 3-Layer-Pattern

---

## ADR-002: Long-List Virtualization Pattern (`react-virtuoso`)

**Date:** 2026-05-01
**Status:** Decided (PROJ-7 ist erste Anwendung; gilt für alle künftigen Listen-Views mit potenziell >200 Items)
**Context:** PROJ-7 Amazon Product Research kann tausende Produkte akkumulieren. Entscheidung: Pagination-Buttons → Infinite Scroll mit DOM-Windowing, damit RAM/CPU bei großen Datasets nicht blowup-en (Flying Research auf Angular hat genau dieses Problem).

### Library-Wahl: react-virtuoso

**Lock-in:** `react-virtuoso` (`<Virtuoso>` für flache Listen, `<VirtuosoGrid>` für Card-Grids).

**Rejected alternatives:**

| Library | Status 2026 | Warum nicht |
|---|---|---|
| `react-virtualized` | Maintenance Mode seit ~2020 | Author selbst hat react-window als Replacement gebaut; keine aktive Entwicklung; ~33kB; class-based legacy API |
| `react-window` | Maintenance Mode seit ~2021 | Selbe Story wie oben; keine Dynamic Heights; Author hat sich zurückgezogen |
| `@tanstack/react-virtual` | Aktiv, sehr gut | Headless = ~3x mehr Wiring-Code; manueller `endReached`-Trigger via `useEffect`; manuelle `position: absolute`+`translateY`-Renderlogik. Sinnvoll wenn Stack TanStack Query nutzt — Merch Miner ist auf RTK Query, kein Ökosystem-Bonus |
| MUI `DataGrid` Built-in Virtualization | Aktiv | Funktioniert nur für Tabellen-Layouts. Card-Grid braucht eigene Lösung. |

**Warum Virtuoso:**
- `<VirtuosoGrid>` purpose-built für responsive Card-Layouts (typisch in MM: Products, Designs, Collected, Niches)
- `endReached` Callback built-in — keine `useEffect`-Tanz für Infinite-Scroll-Trigger
- Auto-Measuring von Dynamic Heights (Cards haben variable Content-Höhen) ohne manuelle Refs
- Code-Volumen ~3x kleiner als TanStack Virtual für gleichen Use-Case
- Components-API spielt sauber mit MUI `styled()` zusammen
- Trade-off: ~20kB größeres Bundle gegenüber TanStack — akzeptabel für Dev-Velocity-Gain

### Standard-Pattern für Listen mit Server-Pagination

Alle MM-Listen-Views, die diesem Pattern folgen, sollen identisch aufgebaut sein:

| Layer | Verantwortung |
|---|---|
| **Backend** | Offset-/Cursor-Pagination via DRF, `page_size` parameter (max 200) |
| **RTK Query** | `useLazy*Query` Hook für imperatives Fetching (statt deklarativem `use*Query`) |
| **Custom Hook** (`use<Domain>InfiniteScroll`) | Akkumuliert Pages in Array, Dedupe-by-ID, `hasMore` flag, `isFetchingNext` flag, request-deduplication |
| **UI Component** | `<VirtuosoGrid>` (Cards) oder `<Virtuoso>` (Listen) — `endReached` → `loadNextPage()` |
| **Loading UX** | Skeleton-Cards in `Footer` slot bei `isFetchingNext`; Empty-State wenn initial leer |

### Page-Size-Konvention

| Phase | Page Size | Begründung |
|---|---|---|
| Initial Search | **100** | Genug Content damit Scroll-Trigger weit unten erst greift; Initial-Scan-Erlebnis |
| Subsequent Loads | **50** | Schnellere Network-Round-Trips; weniger CPU pro Append |
| End Detection | `result_count < page_size` → `hasMore=false` | Kein extra Count-Query nötig (spart DB-Hit) |

### Anwendungsfälle in MM

| View | Status | Anwenden? |
|---|---|---|
| PROJ-7 Amazon Product Grid | First adopter (AC-57 bis AC-63) | ✅ Phase 13 in Tasks |
| PROJ-5 Niche List | DataGrid-basiert, hat eigene Virtualization | Bestehend belassen |
| PROJ-9 Design Gallery | Card-Grid wird wachsen | Bei Performance-Issue migrieren |
| PROJ-7 Collected Products | Card-Grid kann groß werden | Optional retro-fit wenn nötig |
| PROJ-11 Cloud Storage Browser | Card-Grid (OneDrive/GDrive Files) | ✅ einplanen |

### Was NICHT zu tun

- ❌ Doppelte Virtualization (Virtuoso UM ein DataGrid wickeln) — DataGrid hat eigene
- ❌ Client-Side `.slice(0, n)` als "Virtualization" — DOM-Knoten existieren weiter
- ❌ `react-window` / `react-virtualized` für neuen Code — beide Maintenance Mode
- ❌ Initial-Load mit kleiner page_size (z.B. 25) — User sieht Scroll-Triggern sofort, fühlt sich pagination-haft an
- ❌ Scroll-Position-Reset beim Filter-Change vergessen — User landet sonst tief im neuen Result-Set

### Referenzen

- PROJ-7 — First adopter (`features/PROJ-7-amazon-product-research.md` AC-57 bis AC-63, Tasks Phase 13)
- Virtuoso Docs: https://virtuoso.dev/
- Virtuoso GitHub: https://github.com/petyosi/react-virtuoso
- Bundle-Comparison Reference: bundlephobia.com

---

## ADR-003: Multi-Replica `worker-scraper` for Bulk ASIN Throughput

**Date:** 2026-05-05
**Status:** Decided (PROJ-25 Phase F)
**Context:** PROJ-25 needs to scrape 800k+ ASINs in step-wise rollouts (10 → 50 → 1k → 100k). One `worker-scraper` container is bottlenecked at ~10 concurrent ASINs (one Scrapy subprocess per RQ worker). To reach the planned ≥45 sustained concurrent HTTP requests on prod (AC-29) and to keep batch throughput tunable per environment, the service must scale horizontally.

### Decision

`worker-scraper` is now a replicated service driven by an env var:

```yaml
worker-scraper:
  command: python manage.py rqworker scraper
  deploy:
    replicas: ${BACKEND_SCRAPER_WORKERS:-5}
```

`container_name` was removed (named containers conflict with replicas). Compose auto-names replicas (`merch-miner-worker-scraper-1` … `-N`), which is fine for log inspection. Default = 5 replicas (≈ 5–10 GB RAM at peak Scrapy concurrency, fits comfortably on the 32 GB Strato VC). Operator changes `BACKEND_SCRAPER_WORKERS` in `.env` and re-runs `docker compose up -d worker-scraper` — no code change needed.

Verified compatible with Compose v5.1.3 on the production server (`212.132.102.96`).

### Why not `--scale worker-scraper=N`?

`docker compose up --scale` is a runtime override, not declarative. The deploy CI calls `docker compose up -d` without flags, so the scale would reset to 1 on every deploy. `deploy.replicas` is read on every `up`, so the scale persists across deploys.

### References

- PROJ-25 spec AC-27 / AC-28 / AC-29 (`features/PROJ-25-bulk-asin-scrape-batches.md`)
- Memory: `project_800k_scrape_strategy.md` — server-side scrape with 25 ScraperOps slots
- Tasks: `docs/tasks/PROJ-25-tasks.md` Phase F

