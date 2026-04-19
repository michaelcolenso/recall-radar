#!/usr/bin/env bash
# Run once after deploying to apply migrations and seed the historical backfill.
# Prerequisites:
#   - wrangler authenticated (wrangler login)
#   - ADMIN_TOKEN exported in your shell
#   - SITE_URL exported (e.g. https://recallradar.com)
set -euo pipefail

: "${ADMIN_TOKEN:?ADMIN_TOKEN must be set}"
: "${SITE_URL:?SITE_URL must be set}"

echo "==> Applying D1 migrations..."
npx wrangler d1 migrations apply recall-radar-db --remote
echo "    Done."

echo "==> Triggering historical backfill (2015 → present, all 30 makes)..."
RESPONSE=$(curl -sf -X POST "${SITE_URL}/api/admin/ingest" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"mode":"backfill"}')

WORKFLOW_ID=$(echo "$RESPONSE" | grep -o '"workflowId":"[^"]*"' | cut -d'"' -f4)
echo "    Workflow started: ${WORKFLOW_ID}"
echo "    Monitor progress:"
echo "      curl -s ${SITE_URL}/api/admin/backfill-status -H 'Authorization: Bearer \$ADMIN_TOKEN' | jq ."
echo "      curl -s ${SITE_URL}/api/admin/ingest/${WORKFLOW_ID} -H 'Authorization: Bearer \$ADMIN_TOKEN' | jq ."
echo ""
echo "==> After backfill completes, trigger enrichment:"
echo "    curl -X POST ${SITE_URL}/api/admin/enrich \\"
echo "      -H \"Authorization: Bearer \$ADMIN_TOKEN\" \\"
echo "      -H \"Content-Type: application/json\" \\"
echo "      -d '{\"batchSize\":100,\"concurrency\":3}'"
