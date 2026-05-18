#!/usr/bin/env bash
# Set up a git worktree for local development:
#   - symlinks .env.local to the main repo's copy
#   - runs `npm ci` to install dependencies
#
# Safe to re-run; existing setup is left alone.

set -euo pipefail

MAIN_REPO=$(git worktree list --porcelain | awk '/^worktree / { print $2; exit }')
CURRENT_DIR=$(pwd)

if [[ "$MAIN_REPO" == "$CURRENT_DIR" ]]; then
  echo "You're in the main worktree — nothing to set up."
  exit 0
fi

if [[ -L .env.local ]]; then
  echo "✓ .env.local symlink already present"
elif [[ -e .env.local ]]; then
  echo "✗ .env.local exists as a regular file. Move or delete it, then re-run." >&2
  exit 1
else
  if [[ ! -f "$MAIN_REPO/.env.local" ]]; then
    echo "✗ $MAIN_REPO/.env.local not found. Create it in the main repo first." >&2
    exit 1
  fi
  ln -s "$MAIN_REPO/.env.local" .env.local
  echo "✓ Linked .env.local → $MAIN_REPO/.env.local"
fi

if [[ -d node_modules ]]; then
  echo "✓ node_modules already present (run 'npm ci' manually to refresh)"
else
  echo "→ Running npm ci..."
  npm ci
  echo "✓ Dependencies installed"
fi

echo ""
echo "Worktree ready. Start dev with: npm run dev -- -p <port>"
echo "(Use a non-3000 port if another worktree is already running.)"
