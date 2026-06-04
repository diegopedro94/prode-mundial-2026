#!/usr/bin/env bash
# Run the SQL-driven integration tests against the local Supabase DB.
#
# Assumes `npm run db:start` is up. Exit code 0 = all tests pass.

set -euo pipefail

CONTAINER="supabase_db_prode-mundial-2026"

if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  echo "✗ Container ${CONTAINER} not running. Run \`npm run db:start\` first."
  exit 1
fi

for f in supabase/tests/*.sql; do
  echo
  echo "▶ Running $f"
  echo
  docker exec -i "${CONTAINER}" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -X -q < "$f"
done

echo
echo "✅ all SQL integration tests passed"
