# Supabase PostgreSQL Setup — Django Integration

Django verbindet sich zur Supabase-PostgreSQL-Instanz des `localai`-Stacks über `host.docker.internal:5432`.
Kein eigener `db`-Container im merch-miner Stack.

---

## Voraussetzungen

- `localai` Docker-Stack läuft (Supabase `db` Container aktiv)
- Zugriff auf den `localai`-Repo-Ordner (für Docker-Compose-Override)
- `psql` oder `docker exec` auf dem Host verfügbar

---

## Schritt 1 — Supabase Port 5432 nach außen freigeben

Im `localai`-Repo einen Override anlegen, der den DB-Port auf dem Host verfügbar macht.

**Datei anlegen:** `<localai-repo>/supabase/docker/docker-compose.override.yml`

```yaml
services:
  db:
    ports:
      - "5432:5432"
```

Dann den Supabase-Stack mit Override starten:

```bash
cd <localai-repo>
docker compose \
  -f docker-compose.yml \
  -f supabase/docker/docker-compose.yml \
  -f supabase/docker/docker-compose.override.yml \
  up -d
```

**Firewall (Server-Deployment):** Port 5432 nur für Docker-Bridge-Subnetz freigeben, öffentlich sperren:

```bash
ufw allow from 172.16.0.0/12 to any port 5432 comment "Docker bridge – Supabase"
ufw deny 5432
```

---

## Schritt 2 — Schema + User in Supabase anlegen (einmalig)

Verbindung zum Supabase-DB-Container herstellen:

```bash
# Container-Name ermitteln falls unbekannt:
docker ps --filter "name=supabase" --format "{{.Names}}"

# Verbindung (Container-Name anpassen — typisch: supabase-db oder db)
docker exec -it supabase-db psql -U postgres
# alternativ:
docker exec -it db psql -U postgres
```

SQL ausführen (als `postgres`-Superuser):

```sql
-- 1. Schema für Django-Tabellen
CREATE SCHEMA IF NOT EXISTS merch_miner;

-- 2. Dedizierter DB-User
CREATE USER merch_miner_user WITH PASSWORD 'STRONG_PASSWORD_HERE';
ALTER USER merch_miner_user SET search_path TO merch_miner, public;

-- 3. Voller Zugriff auf merch_miner-Schema
GRANT ALL ON SCHEMA merch_miner TO merch_miner_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA merch_miner
  GRANT ALL ON TABLES TO merch_miner_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA merch_miner
  GRANT ALL ON SEQUENCES TO merch_miner_user;

-- 4. Read-only auf public schema (für n8n-Tabellen)
GRANT USAGE ON SCHEMA public TO merch_miner_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO merch_miner_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO merch_miner_user;
```

> `STRONG_PASSWORD_HERE` durch das echte Passwort ersetzen — dieses kommt in `django-app/.env` als `DB_PASSWORD`.

---

## Schritt 3 — Django .env befüllen

```bash
cp django-app/.env.template django-app/.env
```

In `django-app/.env` die DB-Vars setzen:

```env
DB_HOST=host.docker.internal
DB_PORT=5432
DB_NAME=postgres
DB_USER=merch_miner_user
DB_PASSWORD=STRONG_PASSWORD_HERE   # dasselbe Passwort wie in Schritt 2
DB_SCHEMA=merch_miner
```

---

## Schritt 4 — Django starten + Migrationen ausführen

```bash
# Dev-Stack starten (ohne db-Container)
docker compose up --build

# Oder: nur web-Service rebuilden
docker compose up --build web worker
```

Migrationen laufen automatisch über `backend.entrypoint.sh`.
Manuell prüfen:

```bash
docker compose exec web python manage.py migrate
```

---

## Schritt 5 — Verifikation

**1. Supabase vom Host erreichbar:**
```bash
psql -h localhost -p 5432 -U merch_miner_user -d postgres -c "SELECT current_schema();"
# Erwartet: merch_miner
```

**2. Django-Container erreicht Supabase:**
```bash
docker compose exec web python manage.py dbshell
# → psql-Prompt mit merch_miner-Schema sollte erscheinen
```

**3. Tabellen im richtigen Schema:**
```sql
-- In psql-Shell:
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'merch_miner'
  AND table_name LIKE 'django_%'
ORDER BY table_name;
```

**Erwartetes Ergebnis:** `django_migrations`, `django_content_type`, `auth_*`, etc. alle unter `merch_miner`.

---

## Architektur-Überblick

```
localai Docker Stack
  └── db (Supabase PostgreSQL :5432)
        ├── schema: public        ← n8n, Supabase-interne Tabellen
        └── schema: merch_miner   ← Django-Tabellen
              user: merch_miner_user

merch-miner Docker Stack
  └── web    ──→ host.docker.internal:5432
  └── worker ──→ host.docker.internal:5432
  └── redis
  └── frontend
  (kein eigener db-Container)
```

---

## Troubleshooting

| Problem | Ursache | Lösung |
|---------|---------|--------|
| `Connection refused` auf `host.docker.internal:5432` | Port nicht exposed | Schritt 1 prüfen — Override vorhanden und Stack neu gestartet? |
| `FATAL: role "merch_miner_user" does not exist` | SQL in Schritt 2 nicht ausgeführt | Schritt 2 wiederholen |
| Tabellen landen in `public`-Schema | `DB_SCHEMA` fehlt in `.env` | `DB_SCHEMA=merch_miner` eintragen |
| `permission denied for schema merch_miner` | GRANT fehlt | `GRANT ALL ON SCHEMA merch_miner TO merch_miner_user;` wiederholen |
