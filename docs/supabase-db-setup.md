# Supabase PostgreSQL Setup — Django Integration

Django connects to the Supabase PostgreSQL instance via a shared Docker network (`supabase-net`).
No host port exposure required — containers resolve `supabase-db` by name.

---

## Quick Start

```bash
# 1. Copy and fill in credentials
cp django-app/.env.template django-app/.env
# Set DB_USER, DB_PASSWORD (and other vars) in django-app/.env

# 2. Run the idempotent setup script (safe to re-run anytime)
./scripts/init-db.sh

# 3. Start the stack
docker compose up --build
```

> The script handles network creation, container attachment, and schema/user SQL in one step.
> It is safe to run multiple times — it only creates what's missing.

---

## What `init-db.sh` Does

| Step | Action | Re-run behavior |
|------|--------|-----------------|
| Network | Creates `supabase-net` if missing | No-op |
| Container | Connects `supabase-db` to `supabase-net` if not connected | No-op |
| Schema | `CREATE SCHEMA IF NOT EXISTS merch_miner` | No-op |
| User | Creates user if missing; updates password if exists | Updates pw |
| Grants | Applies `GRANT` statements | Idempotent |

---

## When to Re-run

| Situation | Action needed |
|-----------|--------------|
| First-time setup | `./scripts/init-db.sh` |
| localai stack rebuilt (containers deleted + recreated) | `./scripts/init-db.sh` (re-attaches container to network) |
| Schema/user already set up, only new stack | Just `docker compose up --build` |

> Find your Supabase DB container name if different from `supabase-db`:
> ```bash
> docker ps --filter "name=supabase" --format "{{.Names}}"
> SUPABASE_CONTAINER=my-postgres ./scripts/init-db.sh
> ```

---

## Django .env

```bash
cp django-app/.env.template django-app/.env
```

Set DB vars in `django-app/.env`:

```env
DB_HOST=supabase-db
DB_PORT=5432
DB_NAME=postgres
DB_USER=merch_miner_user
DB_PASSWORD=STRONG_PASSWORD_HERE
DB_SCHEMA=merch_miner
```

---

## Verification

**1. Django reaches Supabase:**
```bash
docker compose exec web python manage.py dbshell
# → psql prompt in merch_miner schema
```

**2. Both containers on shared network:**
```bash
docker network inspect supabase-net --format '{{range .Containers}}{{.Name}} {{end}}'
# → supabase-db app_backend app_worker
```

**3. Tables in correct schema (after migrations):**
```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'merch_miner'
  AND table_name LIKE 'django_%'
ORDER BY table_name;
```

**4. Host port NOT exposed (confirm isolation):**
```bash
psql -h localhost -p 5432 -U merch_miner_user -d postgres
# → should FAIL (Connection refused)
```

---

## Architecture

```
localai Docker Stack
  └── supabase-db (PostgreSQL)
        ├── schema: public        ← n8n, Supabase-internal tables
        └── schema: merch_miner   ← Django tables
              user: merch_miner_user

Shared Docker Network: supabase-net
  └── supabase-db  ←──────────────────┐
  └── app_backend  (web)   ───────────┤ direct container DNS
  └── app_worker   (worker) ──────────┘

merch-miner Docker Stack
  └── web     → supabase-db:5432 (via supabase-net)
  └── worker  → supabase-db:5432 (via supabase-net)
  └── redis
  └── frontend
  (no local db container)
```

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `Connection refused` on `supabase-db` | Network not created or container not attached | `./scripts/init-db.sh` |
| `could not translate host name "supabase-db"` | Container not on `supabase-net` | `./scripts/init-db.sh` |
| `FATAL: role "merch_miner_user" does not exist` | Script not run | `./scripts/init-db.sh` |
| Tables land in `public` schema | `DB_SCHEMA` missing in `.env` | Add `DB_SCHEMA=merch_miner` |
| `permission denied for schema merch_miner` | GRANT missing | `./scripts/init-db.sh` |
