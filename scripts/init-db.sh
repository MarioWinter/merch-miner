#!/usr/bin/env bash
# scripts/init-db.sh — Idempotent Supabase DB setup for merch-miner
# Safe to run multiple times; only creates what's missing.
set -euo pipefail

SUPABASE_CONTAINER="${SUPABASE_CONTAINER:-supabase-db}"
ENV_FILE="$(dirname "$0")/../django-app/.env"

# --- Prereqs ---
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found. Copy django-app/.env.template to django-app/.env first." >&2
  exit 1
fi

if ! docker inspect "$SUPABASE_CONTAINER" &>/dev/null; then
  echo "ERROR: Container '$SUPABASE_CONTAINER' not found or not running." >&2
  exit 1
fi

# Read credentials from .env (no eval — use grep + parameter expansion)
DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | head -1 | cut -d= -f2-)
DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2-)

if [[ -z "$DB_USER" || -z "$DB_PASSWORD" ]]; then
  echo "ERROR: DB_USER or DB_PASSWORD missing in $ENV_FILE." >&2
  exit 1
fi

echo "==> DB_USER: $DB_USER"

# --- Step 1: Ensure supabase-net network exists ---
if ! docker network inspect supabase-net &>/dev/null; then
  echo "==> Creating docker network: supabase-net"
  docker network create supabase-net
else
  echo "==> Network supabase-net already exists"
fi

# --- Step 2: Connect supabase-db to supabase-net (no-op if already connected) ---
if docker network inspect supabase-net --format '{{range .Containers}}{{.Name}} {{end}}' \
    | grep -qw "$SUPABASE_CONTAINER"; then
  echo "==> $SUPABASE_CONTAINER already on supabase-net"
else
  echo "==> Connecting $SUPABASE_CONTAINER to supabase-net"
  docker network connect supabase-net "$SUPABASE_CONTAINER"
fi

# --- Step 3: Schema + user SQL ---
echo "==> Running schema/user SQL on $SUPABASE_CONTAINER"

# Password passed via bash variable in heredoc — not exposed as CLI arg
docker exec -i "$SUPABASE_CONTAINER" psql -U postgres <<SQL
-- Schema
CREATE SCHEMA IF NOT EXISTS merch_miner;

-- User (create or update password)
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
    CREATE USER "$DB_USER" WITH PASSWORD '$DB_PASSWORD';
  ELSE
    ALTER USER "$DB_USER" WITH PASSWORD '$DB_PASSWORD';
  END IF;
END
\$\$;

-- search_path
ALTER USER "$DB_USER" SET search_path TO merch_miner, public;

-- Full access on merch_miner schema
GRANT ALL ON SCHEMA merch_miner TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA merch_miner GRANT ALL ON TABLES TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA merch_miner GRANT ALL ON SEQUENCES TO "$DB_USER";

-- Read-only on public schema (n8n tables)
GRANT USAGE ON SCHEMA public TO "$DB_USER";
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "$DB_USER";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "$DB_USER";
SQL

echo "==> Done. Run 'docker compose up --build' to start merch-miner."
