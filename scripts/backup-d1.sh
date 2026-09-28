#!/usr/bin/env bash
# Includes application schema/data and CMS-referenced R2 media; verifies restoration.
# Private backups go in ignored backups/. LOCAL=1 selects local D1.
set -euo pipefail
args=()
if [[ "${LOCAL:-0}" == "1" ]]; then args+=(--local); fi
if [[ -n "${BACKUP_DIR:-}" ]]; then
  args+=(--output "$BACKUP_DIR/crafted-$(date -u +%Y-%m-%dT%H-%M-%SZ)")
fi
exec python3 "$(dirname "$0")/backup-site.py" "${args[@]}" "$@"
