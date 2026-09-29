#!/bin/bash
# Cloud sessions start from a fresh clone: install dependencies so tests and
# lint run, and bring the committed knowledge graph up to date with the code
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

# The graph records the commit it was built from. Only rebuild when something
# outside graphify-out/ changed since then, so an up-to-date checkout doesn't
# start the session with a modified graph.
built_at=$(node -e 'try { process.stdout.write(require("./graphify-out/graph.json").built_at_commit ?? "") } catch {}')
if [ -n "$built_at" ] && git cat-file -e "$built_at^{commit}" 2>/dev/null \
  && git diff --quiet "$built_at" HEAD -- . ':(exclude)graphify-out'; then
  echo "graphify: committed graph is current (built at ${built_at:0:8})"
else
  npm run graph:update
fi
