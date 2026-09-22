# Linux installation

JukeboxCli runs on 64-bit Linux with Node.js 22 or newer, mpv and ffmpeg. The
source installer builds a standalone global command from the checkout. It does
not keep the installed command linked to the repository.

## Arch Linux

Install Git if it is missing, then clone and run the installer:

```sh
sudo pacman -S --needed git
git clone https://github.com/funstuie-bit/JukeboxCli.git
cd JukeboxCli
./install.sh
jukeboxcli --doctor
jukeboxcli
```

Current main's installer installs missing Arch dependencies before building:
Node.js, npm, mpv, ffmpeg, tar, projectM/Classic presets, pactl and the Qt 5/C++
build tools for the private fullscreen companion. First fullscreen setup fetches
~53 MB of verified source and builds the logo-free frontend. Only missing
system packages require sudo; pacman displays its normal confirmation. Do not
run the whole installer as root. Version-manager Node must still be 22 or newer.

Use `--no-visualizer` for the core player without the fullscreen engine;
`--with-cream-of-the-crop` to download/select extra presets and textures;
`--with-browser-cookies` for Chromium/GNOME Keyring dependencies; or
`--no-system-deps` to manage native dependencies yourself. Extras are never
silently downloaded on startup. These installer changes are not yet tagged.

The installer uses npm's configured global prefix when the current user can
write there. Distribution npm packages commonly configure a system-owned
prefix such as `/usr`; in that case JukeboxCli automatically installs under
`$HOME/.local` without requiring sudo. Ensure `$HOME/.local/bin` is on `PATH`.
You can also choose an absolute prefix explicitly:

```sh
./install.sh --prefix "$HOME/.local"
```

## Other Linux distributions

Install Node.js 22 or newer, npm, mpv and ffmpeg with your distribution's package
manager, then run the same clone and install commands above. Common package
commands are:

```sh
# Debian or Ubuntu
sudo apt install mpv ffmpeg

# Fedora
sudo dnf install mpv ffmpeg

# openSUSE
sudo zypper install mpv ffmpeg
```

Some stable distributions ship an older Node.js release. Use the
[Node.js package-manager guide](https://nodejs.org/en/download/package-manager)
or a version manager rather than continuing with Node.js 21 or older.

## Tools and files

On Linux, JukeboxCli prefers the distribution's ffmpeg and ffprobe because they
are integrated with its TLS and codec libraries. If they are unavailable, it can
fall back to app-managed copies. yt-dlp remains app-managed in automatic mode
and follows the nightly channel by default. Settings → yt-dlp updates can switch
to stable or back to nightly and download an update for the next launch.
Package-managed installs with `JUKEBOXCLI_SYSTEM_TOOLS=1` default to system yt-dlp
but can opt into a separate app-managed copy in Settings without changing
mpv/ffmpeg ownership. Choose System / package manager to switch back; restart
after either change. `jukeboxcli --doctor` reports the selected provider, requested
channel, cached version, pending update and system tools on `PATH`
without downloading or changing anything.

Browser-cookie setup detects Chrome, Chromium, Edge, Brave and Firefox profiles
in their standard Linux config directories. Choose one under Settings → Download
settings → Cookies; JukeboxCli passes the selected profile to yt-dlp without
copying the cookie database. When a GNOME Keyring Secret Service is active,
Chromium-family profiles include that keyring explicitly so encrypted cookies
do not fall back to an anonymous request. Firefox and non-GNOME keyrings retain
yt-dlp's normal platform handling.

Fresh Linux profiles use these locations:

- Music: `~/Music/JukeboxCli`
- Config: `~/.config/JukeboxCli`
- Data: `~/.local/share/JukeboxCli`
- Cache: `~/.cache/JukeboxCli`
- Logs: `~/.local/state/JukeboxCli`

These follow the XDG environment variables when they are set. Run with an
isolated profile when testing:

```sh
JUKEBOXCLI_HOME="$HOME/JukeboxCli-demo" jukeboxcli
```

Foot and other Sixel terminals automatically use high-resolution Sixel artwork.
The player uses incremental terminal updates so changing visualizer rows do not
erase and flash unchanged artwork rows. Set `JUKEBOXCLI_ART=blocks` to request blocks
explicitly. Ghostty and Kitty-compatible terminals use their persistent image
protocol. The live visualizer is also enabled by default on Linux; use
`JUKEBOXCLI_VISUALIZER=0 jukeboxcli` for the static waveform and no live analysis.
macOS media-key bridging is not available on Linux; playback controls
inside JukeboxCli work normally.

The optional fullscreen effects mode uses projectM's PulseAudio frontend.
The current Arch installer includes it by default. For an older/minimal install:

```sh
sudo pacman -S --needed projectm-pulseaudio libpulse gcc make pkgconf qt5-base
jukeboxcli --install-linux-visualizer
```

Then press uppercase `F` in Now Playing, or open it from **Settings → Player
appearance**. JukeboxCLI points projectM at the current PipeWire/PulseAudio
output monitor and asks it to start fullscreen. Closing the projectM window
leaves playback and the terminal visualiser running. It starts with a shuffled
community preset before the first rendered frame, so the branded introduction
never appears. Current main uses a private patched frontend against system
libprojectM 3.1.12 and Qt 5; the distro binary is not modified.

Settings → Player appearance → MilkDrop packs offers Classic, an optional Cream
of the Crop download (with textures), and Combined/shuffled after installation.
See [pack downloads, storage and provenance](linux-preset-packs.md).

## Updating

From a clean checkout:

```sh
cd JukeboxCli
./update.sh
```

The updater refuses to overwrite local changes. Commit or stash them first.

## Uninstalling

Remove the globally installed package with:

```sh
npm uninstall --global jukeboxcli
```

For an installation that used the automatic Linux fallback:

```sh
npm uninstall --global --prefix "$HOME/.local" jukeboxcli
```

This leaves your music and profile data in place.
