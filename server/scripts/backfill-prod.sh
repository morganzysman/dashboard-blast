#!/usr/bin/env bash
#
# Backfill the production order ledger from the OlaClick Public API.
#
# Pulls the production Postgres connection string from the Railway CLI
# (DATABASE_PUBLIC_URL of the "Postgres" service) and runs the resumable
# node backfill CLI once per account that has a public_api_key, in parallel
# (each restaurant key is its own rate-limit bucket), writing a log per account.
#
# Usage:
#   ./server/scripts/backfill-prod.sh <FROM> [TO]
#   ./server/scripts/backfill-prod.sh 2024-01-01
#   ./server/scripts/backfill-prod.sh 2024-01-01 2026-07-20
#
# Env overrides (optional, forwarded to the node CLI):
#   COMBO_INTER_ORDER_SLEEP_MS, COMBO_INTER_ACCOUNT_SLEEP_MS, COMBO_INTER_DAY_SLEEP_MS
#
# Prereqs: railway CLI linked to the project (`railway status`), python3, node.

set -euo pipefail

FROM="${1:-}"
TO="${2:-}"

if [[ -z "$FROM" ]]; then
  echo "Usage: $0 <FROM YYYY-MM-DD> [TO YYYY-MM-DD]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$SCRIPT_DIR"

echo "🔑 Fetching production DATABASE_PUBLIC_URL from Railway…"
DATABASE_URL="$(railway variables --service Postgres --json \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["DATABASE_PUBLIC_URL"])')"
export DATABASE_URL
echo "   Using: $(echo "$DATABASE_URL" | sed -E 's#^(postgres[^:]*://)[^@]*@#\1***@#')"

# Discover the tokens that actually have a public_api_key.
echo "🔎 Finding accounts with a public_api_key…"
TOKENS="$(node --input-type=module -e "
import { pool } from './server/database.js';
const r = await pool.query('SELECT company_token FROM company_accounts WHERE public_api_key IS NOT NULL ORDER BY company_token');
console.log(r.rows.map(x=>x.company_token).join(' '));
await pool.end();
" 2>/dev/null | tail -1)"

if [[ -z "${TOKENS// }" ]]; then
  echo "❌ No accounts have a public_api_key set. Aborting." >&2
  exit 1
fi

echo "   Keyed accounts: $TOKENS"
echo "📅 Range: $FROM → ${TO:-today} (newest-first)"
echo ""

# Build optional --to args. Use the bash-3.2-safe empty-array expansion so
# `set -u` doesn't choke when --to was omitted.
TO_ARGS=()
[[ -n "$TO" ]] && TO_ARGS=(--to "$TO")

mkdir -p backfill-logs
PIDS=()
for TOKEN in $TOKENS; do
  LOG="backfill-logs/backfill-${TOKEN}.log"
  echo "🚀 Launching backfill for $TOKEN → $LOG"
  DATABASE_URL="$DATABASE_URL" nohup node server/scripts/backfill-ledger.mjs \
    --from "$FROM" ${TO_ARGS[@]+"${TO_ARGS[@]}"} --token "$TOKEN" --desc \
    > "$LOG" 2>&1 &
  PIDS+=($!)
done

echo ""
echo "✅ Launched ${#PIDS[@]} backfill process(es): ${PIDS[*]}"
echo "   Watch progress:   tail -f backfill-logs/*.log"
echo "   Stop everything:  kill ${PIDS[*]}"
echo ""
echo "Waiting for all backfills to finish (safe to Ctrl-C this waiter; the"
echo "background jobs keep running)…"
wait "${PIDS[@]}"
echo "🏁 All backfills finished."
