#!/bin/sh
# Install a built package, not a link back into a development checkout.
# Run from the repo root: ./install.sh
# Requires Node.js 22+ and mpv. See README.md for platform-specific commands.

set -eu
cd "$(dirname "$0")"
install_prefix=""
install_check=0
install_system_deps=1
install_visualizer=1
install_browser_cookies=0
install_cream=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --prefix) [ "$#" -ge 2 ] || { echo "--prefix needs a directory" >&2; exit 2; }; install_prefix=$2; shift 2 ;;
    --check) install_check=1; shift ;;
    --no-system-deps) install_system_deps=0; shift ;;
    --no-visualizer) install_visualizer=0; shift ;;
    --with-browser-cookies) install_browser_cookies=1; shift ;;
    --with-cream-of-the-crop) install_cream=1; shift ;;
    --help)
      echo "Usage: ./install.sh [--prefix /absolute/directory] [--check]"
      echo "Arch: installs core dependencies + projectM/Classic by default (uses sudo only for missing packages)."
      echo "  --no-visualizer            omit optional fullscreen engine/Classic"
      echo "  --with-cream-of-the-crop   download/select extra presets + textures (~14 MB; Linux only)"
      echo "  --with-browser-cookies    install Chromium/GNOME Keyring support on Arch"
      echo "  --no-system-deps          manage system packages yourself"
      echo "Fullscreen setup builds a private logo-free frontend (first setup: ~53 MB source download)."
      exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
done
if [ "$install_cream" -eq 1 ] && { [ "$install_visualizer" -eq 0 ] || [ "$(uname -s)" != Linux ]; }; then
  echo "--with-cream-of-the-crop requires Linux and cannot be combined with --no-visualizer." >&2
  exit 2
fi
if [ -n "$install_prefix" ]; then
  case "$install_prefix" in /*) ;; *) echo "--prefix must be an absolute directory" >&2; exit 2 ;; esac
fi

if [ "$install_check" -eq 0 ] && [ "$install_system_deps" -eq 1 ]; then
  . ./scripts/install-linux-deps.sh
  ensure_linux_dependencies
fi

# Node version check (needs >= 22)
if ! command -v node >/dev/null 2>&1; then
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "Node.js not found. Install it first: brew install node@22"
  else
    echo "Node.js not found. Install Node.js 22 or newer, then rerun this installer."
    echo "See: https://nodejs.org/en/download/package-manager"
  fi
  exit 1
fi
install_node_major=$(node -e 'console.log(process.versions.node.split(".")[0])')
if [ "$install_node_major" -lt 22 ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "Node.js $install_node_major found, but 22+ is required. Upgrade: brew upgrade node"
  else
    echo "Node.js $install_node_major found, but 22+ is required. Upgrade Node.js, then rerun this installer."
    echo "See: https://nodejs.org/en/download/package-manager"
  fi
  exit 1
fi

if [ "$install_check" -eq 0 ]; then
  . ./scripts/install-mpv.sh
  ensure_install_mpv
fi

echo "Installing Node dependencies..."
npm ci

echo "Building..."
npm run build
npx --no-install tsx scripts/check-dist-imports.ts
node dist/index.js --version
if [ "$install_check" -eq 1 ]; then
  echo "Build verified; no global installation or profile changes made."
  exit 0
fi

# Finish optional downloads before replacing an existing global app.
if [ "$install_visualizer" -eq 1 ] && [ "$(uname -s)" = Linux ] && command -v pacman >/dev/null 2>&1; then
  node dist/index.js --install-linux-visualizer
fi
if [ "$install_cream" -eq 1 ]; then
  node dist/index.js --install-preset-pack cream-of-the-crop
fi

if [ -z "$install_prefix" ]; then
  install_npm_prefix=$(npm config get prefix)
  install_npm_prefix_writable=0
  if [ -d "$install_npm_prefix" ] && [ -w "$install_npm_prefix" ]; then
    install_npm_prefix_writable=1
  elif [ ! -e "$install_npm_prefix" ]; then
    install_npm_parent=$(dirname "$install_npm_prefix")
    while [ ! -e "$install_npm_parent" ] && [ "$install_npm_parent" != "/" ]; do
      install_npm_parent=$(dirname "$install_npm_parent")
    done
    if [ -d "$install_npm_parent" ] && [ -w "$install_npm_parent" ]; then
      install_npm_prefix_writable=1
    fi
  fi
  if [ "$install_npm_prefix_writable" -eq 0 ]; then
    install_prefix="${HOME:?HOME is required for a user installation}/.local"
    echo "npm's global prefix ($install_npm_prefix) is unavailable to this user."
    echo "Installing JukeboxCli under $install_prefix instead."
  fi
fi

echo "Installing global command..."
install_stage=$(mktemp -d "${TMPDIR:-/tmp}/jukeboxcli-install.XXXXXX")
install_archive=$(node --import tsx scripts/pack-install.ts "$install_stage")
if [ -n "$install_prefix" ]; then
  npm install --global --ignore-scripts --prefix "$install_prefix" "$install_stage/$install_archive"
  "$install_prefix/bin/jukeboxcli" --version
  echo "Add $install_prefix/bin to PATH if needed."
else
  npm install --global --ignore-scripts "$install_stage/$install_archive"
fi
echo "Package retained for rollback/reinstall: $install_stage/$install_archive"

echo ""
echo "Done. Run it from anywhere with:  jukeboxcli"
if [ -n "$install_prefix" ]; then
  echo "Installed at: $install_prefix/bin/jukeboxcli"
else
  command -v jukeboxcli >/dev/null 2>&1 && echo "Installed at: $(command -v jukeboxcli)"
fi
exit 0
