# Linux installation

JukeboxCli runs on 64-bit Linux with Node.js 22 or newer, mpv and ffmpeg. The
source installer builds a standalone global command from the checkout. It does
not keep the installed command linked to the repository.

## Arch Linux

Install the required packages:

```sh
sudo pacman -S --needed nodejs npm mpv ffmpeg
```

Check that Node.js is new enough:

```sh
node --version
```

The first number must be 22 or higher. If the distribution package is older,
install a current Node.js release with [mise](https://mise.jdx.dev/) or another
version manager before continuing.

Clone and install JukeboxCli:

```sh
git clone https://github.com/funstuie-bit/JukeboxCli.git
cd JukeboxCli
./install.sh
jukeboxcli --doctor
jukeboxcli
```

The installer uses npm's configured global prefix. If `jukeboxcli` is not found
after installation, add the `bin` directory under `npm config get prefix` to
your `PATH`, or choose a prefix already on it:

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
fall back to app-managed copies. yt-dlp remains app-managed in automatic mode.
`jukeboxcli --doctor` reports the system tools visible on `PATH`.

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

This leaves your music and profile data in place.
