#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METADATA_FILE="${SCRIPT_DIR}/metadata.json"
ENDPOINT="http://localhost:3000/api/ingest/ingest_paper_source"

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed." >&2
  exit 1
fi

index=0
jq -c '.[]' "${METADATA_FILE}" | while IFS= read -r obj; do
  index=$((index + 1))
  echo "[$index] POST ${ENDPOINT}"
  curl --fail --show-error --silent \
    -X POST "${ENDPOINT}" \
    -H "Content-Type: application/json" \
    -d "${obj}"
  echo
done
