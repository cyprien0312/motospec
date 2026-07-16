#!/usr/bin/env bash
# Auto-archive MotoSpec progress: commit any working-tree changes,
# then push if a remote named "origin" is configured (skips quietly otherwise).
# Installed in user crontab; logs to logs/auto-archive.log.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

# single-instance guard (same pattern as ~/motogp-tracker cron jobs)
exec 9>"$REPO/.git/auto-archive.lock"
flock -n 9 || exit 0

git add -A
if ! git diff --cached --quiet; then
  git commit -m "chore: auto-archive $(date +'%F %H:%M')"
  echo "[$(date +'%F %H:%M')] committed: $(git log -1 --stat --oneline | head -1)"
fi

if git remote get-url origin >/dev/null 2>&1; then
  git push origin HEAD
else
  echo "[$(date +'%F %H:%M')] no remote 'origin' configured — push skipped"
fi
