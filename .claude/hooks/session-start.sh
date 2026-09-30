#!/bin/bash
# Cloud sessions start from a fresh clone: install dependencies so tests and
# lint run, and build the knowledge graph, which is not committed
# (see "graphify" in CLAUDE.md).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

npm install --no-audit --no-fund

if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install graphifyy
  else
    pip install --user graphifyy
  fi
fi

# The graph is not committed: rebuild it from the code and the committed
# semantic cache (seconds, no LLM).
npm run graph:update
