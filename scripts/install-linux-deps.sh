#!/bin/sh
# Sourced before Node checks: a fresh Arch clone may not have Node/npm yet.
ensure_linux_dependencies() {
  [ "$(uname -s)" = Linux ] || return 0
  if ! command -v pacman >/dev/null 2>&1; then
    echo "Automatic Linux system dependencies currently support Arch/pacman."
    echo "On other distributions install Node 22+, npm, mpv and ffmpeg with your package manager."
    echo "Fullscreen effects also need projectM-pulseaudio and pactl; see docs/linux-development-handover.md."
    return 0
  fi
  set -- git nodejs npm mpv ffmpeg tar
  if [ "${install_visualizer:-1}" -eq 1 ]; then set -- "$@" projectm-pulseaudio libpulse; fi
  if [ "${install_browser_cookies:-0}" -eq 1 ]; then set -- "$@" chromium gnome-keyring libsecret; fi
  install_missing=""
  for install_package in "$@"; do
    if ! pacman -Q "$install_package" >/dev/null 2>&1; then
      install_missing="$install_missing $install_package"
    fi
  done
  if [ -z "$install_missing" ]; then echo "Arch system dependencies are ready."; return 0; fi
  echo "Installing missing Arch packages:$install_missing"
  echo "pacman will show the transaction and request confirmation; sudo may request your password."
  # Package names come only from the fixed list above. Intentionally split words.
  if [ "$(id -u)" -eq 0 ]; then
    pacman -S --needed $install_missing || return 1
  else
    sudo pacman -S --needed $install_missing || return 1
  fi
  for install_package in "$@"; do
    if ! pacman -Q "$install_package" >/dev/null 2>&1; then
      echo "Required package is still missing: $install_package. JukeboxCli has not been replaced." >&2
      return 1
    fi
  done
}
