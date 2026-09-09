#!/bin/sh
# Install a built package, not a link back into a development checkout.
# Run from the repo root: ./install.sh
# Requires Node.js 22+ (brew install node@22 or https://nodejs.org)

set -eu
cd "$(dirname "$0")"
install_prefix=""
install_check=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix) [ "$#" -ge 2 ] || { echo "--prefix needs a directory" >&2; exit 2; }; install_prefix=$2; shift 2 ;;
    --check) install_check=1; shift ;;
    --help) echo "Usage: ./install.sh [--prefix /absolute/directory] [--check]"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
if [ -n "$install_prefix" ]; then
  case "$install_prefix" in /*) ;; *) echo "--prefix must be an absolute directory" >&2; exit 2 ;; esac
fi

# Node version check (needs >= 22)
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install it first: brew install node@22"
  exit 1
fi
install_node_major=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$install_node_major" -lt 22 ]; then
  echo "Node.js $install_node_major found, but 22+ is required. Upgrade: brew upgrade node"
  exit 1
fi

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build
npx --no-install tsx scripts/check-dist-imports.ts
node dist/index.js --version
if [ "$install_check" -eq 1 ]; then
  echo "Build verified; no global installation or profile changes made."
  exit 0
fi

echo "Installing global command..."
install_stage=$(mktemp -d "${TMPDIR:-/tmp}/jukeboxcli-install.XXXXXX")
install_archive=$(npm pack --ignore-scripts --pack-destination "$install_stage" --silent)
if [ -n "$install_prefix" ]; then
  npm install --global --ignore-scripts --prefix "$install_prefix" "$install_stage/$install_archive"
  "$install_prefix/bin/jukeboxcli" --version
  echo "Add $install_prefix/bin to PATH if needed."
else
  npm install --global --ignore-scripts "$install_stage/$install_archive"
fi
echo "Package retained for rollback/reinstall: $install_stage/$install_archive"

echo ""
echo "Done. Run it from anywhere with:  jukeboxcli (soundcli is a compatibility alias)"
if [ -n "$install_prefix" ]; then
  echo "Installed at: $install_prefix/bin/jukeboxcli"
else
  command -v jukeboxcli >/dev/null 2>&1 && echo "Installed at: $(command -v jukeboxcli)"
fi
exit 0
