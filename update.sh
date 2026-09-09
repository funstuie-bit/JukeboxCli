#!/bin/sh
# Explicit source-checkout update. Homebrew users should use brew upgrade.
set -eu
cd "$(dirname "$0")"
if [ -n "$(git status --porcelain)" ]; then
  echo "Checkout has local changes. Commit/stash them yourself before updating; nothing changed." >&2
  exit 1
fi
git pull --ff-only
exec sh ./install.sh "$@"
