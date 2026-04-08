#!/usr/bin/env bash
#
# Operator-run D1 backup — wraps `wrangler d1 export` to create a SQL dump
# of the production `crafted` database, timestamped and optionally gzipped.
#
# Usage:
#   ./scripts/backup-d1.sh                 # remote DB, writes to ./backups/
#   BACKUP_DIR=/tmp ./scripts/backup-d1.sh # custom dir
#   LOCAL=1 ./scripts/backup-d1.sh         # dump the local D1 instead
#
# The HTTP `/api/admin/backup` endpoint is the cron-triggered equivalent
# that writes NDJSON to R2 for automated backups; this script is for
# humans who want a SQL dump they can `sqlite3 < file.sql` to restore.

set -euo pipefail

DB_NAME="crafted"
BACKUP_DIR="${BACKUP_DIR:-backups}"
REMOTE_FLAG="--remote"
if [[ "${LOCAL:-0}" == "1" ]]; then
  REMOTE_FLAG="--local"
fi

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
OUTPUT="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql"

echo "→ Dumping D1 database '$DB_NAME' ($REMOTE_FLAG) to $OUTPUT"
npx wrangler d1 export "$DB_NAME" "$REMOTE_FLAG" --output="$OUTPUT"

if command -v gzip >/dev/null 2>&1; then
  gzip "$OUTPUT"
  echo "✓ Backup written: ${OUTPUT}.gz ($(wc -c <"${OUTPUT}.gz") bytes)"
else
  echo "✓ Backup written: $OUTPUT"
fi
