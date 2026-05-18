#!/bin/bash
set -euo pipefail
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)
remote=$(git remote -v 2>/dev/null | awk '/github.com/ {print $1; exit}' || true)
if [ -z "$remote" ]; then
  remote=$(git remote | head -n1 || true)
fi
echo "BRANCH:$branch"
echo "REMOTE:$remote"
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "UNCOMMITTED: true"
  echo "Status:"
  git status --porcelain
  git add -A
  if git commit -m "chore: commit local changes before pushing (automated)"; then
    echo "COMMITTED: $(git rev-parse --short HEAD)"
  else
    echo "COMMIT_FAILED"
    exit 2
  fi
else
  echo "UNCOMMITTED: false"
fi
