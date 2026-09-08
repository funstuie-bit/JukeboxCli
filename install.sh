#!/bin/sh
# Install JukeboxCli globally on this Mac (includes the soundcli alias).
# Run from the repo root: ./install.sh
# Requires Node.js 22+ (brew install node@22 or https://nodejs.org)

set -e
cd "$(dirname "$0")"

# Node version check (needs >= 22)
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install it first: brew install node@22"
  exit 1
fi
NODE_MAJOR=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node.js $NODE_MAJOR found, but 22+ is required. Upgrade: brew upgrade node"
  exit 1
fi

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

echo "Installing global command..."
npm install -g .

echo ""
echo "Done. Run it from anywhere with:  jukeboxcli (soundcli is a compatibility alias)"
command -v jukeboxcli >/dev/null 2>&1 && echo "Installed at: $(command -v jukeboxcli)"
