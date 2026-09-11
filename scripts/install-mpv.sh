#!/bin/sh
# Sourced by install.sh. Keep errors visible; never replace the app on failure.
ensure_install_mpv() {
  if mpv --version >/dev/null 2>&1; then
    echo "mpv is ready."
    return 0
  fi
  if [ "$(uname -s)" != "Darwin" ]; then
    echo "mpv is required. Install it using your system package manager, then rerun this installer." >&2
    return 1
  fi
  install_brew=$(command -v brew || true)
  if [ -z "$install_brew" ]; then
    for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
      if [ -x "$candidate" ]; then install_brew=$candidate; break; fi
    done
  fi
  if [ -z "$install_brew" ]; then
    echo "mpv is missing and Homebrew was not found. Install Homebrew, run 'brew install mpv', then rerun this installer." >&2
    return 1
  fi
  # Probe Homebrew's bin too: a GUI terminal may have an incomplete PATH.
  install_brew_prefix=$("$install_brew" --prefix) || return 1
  PATH="$install_brew_prefix/bin:$PATH"
  export PATH
  if mpv --version >/dev/null 2>&1; then
    echo "mpv is ready."
    return 0
  fi
  echo "Installing mpv with Homebrew..."
  if ! "$install_brew" install mpv; then
    echo "mpv installation failed. Resolve the Homebrew error above and rerun this installer. JukeboxCli has not been replaced." >&2
    return 1
  fi
  if ! mpv --version; then
    echo "Homebrew finished, but mpv could not run. Try 'brew reinstall mpv', then rerun this installer. JukeboxCli has not been replaced." >&2
    return 1
  fi
}
