#!/bin/sh
set -e

echo "Waiting for PostgreSQL on $DB_HOST:$DB_PORT..."
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -q; do
  sleep 1
done
echo "PostgreSQL ready. Starting worker..."

exec "$@"
