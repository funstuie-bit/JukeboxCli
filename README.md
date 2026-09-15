# JukeboxCli

A music player that lives in the terminal, for macOS and Linux.

**Current release: 1.0.4.** It adds safe user-prefix installation on Linux and
keeps large terminal pastes from escaping into the shell. It also includes the
accepted artwork, visualisers, radio and Chromium-cookie work, quick radio
channels, yt-dlp release channels and five player themes.

I started this as a boredom project and it got slightly out of hand. JukeboxCli now plays local music, searches YouTube Music without an account, handles live radio and keeps the lot in one editable queue. Streams stay streams unless you choose to save them.

[![Mac install checks](https://github.com/funstuie-bit/JukeboxCli/actions/workflows/mac-install.yml/badge.svg?branch=main)](https://github.com/funstuie-bit/JukeboxCli/actions/workflows/mac-install.yml)
[![Linux install checks](https://github.com/funstuie-bit/JukeboxCli/actions/workflows/linux-install.yml/badge.svg?branch=main)](https://github.com/funstuie-bit/JukeboxCli/actions/workflows/linux-install.yml)

![JukeboxCli demo](docs/assets/jukeboxcli-demo.gif)

## What it does

- Plays local files, YouTube results, direct audio links and live radio.
- Keeps local, online and live tracks in one persistent queue.
- Searches songs, videos, albums, artists and playlists without a YouTube login.
- Shows sharp cover artwork in Ghostty, Kitty-compatible, iTerm2 and Sixel terminals, with text and block fallbacks elsewhere.
- Runs a live visualiser by default on Mac and Linux, with six styles you can cycle using `v`.
- Supports local LRC files and optional online lyrics.
- Downloads from YouTube and SoundCloud, and imports music from supported Spotify links.
- Handles shuffle, repeat, queue editing and listening history. mpv supplies playback and macOS media-key support.

Playing or browsing online music does not add it to your library. Downloads only start when you ask for one.

On Linux, Chromium-family cookie selections use GNOME Keyring when its Secret
Service is present, so yt-dlp can decrypt the signed-in browser session instead
of silently falling back to anonymous requests.

The player puts station/song information above its artwork, alongside a clearly
named **Playback queue**. Very wide terminals use a balanced 45/55 split, artwork
up to 56 columns × 24 rows and a taller visualiser. Queue rows fill their panel,
with the time column and selection highlight reaching its right edge, and both
panels share a bottom edge. Their shortcut groups share one row below the divider,
separated by `│`, instead of placing queue controls inside its panel. Standard
two-panel windows keep the smaller layout, and compact windows stack details
over the queue.

Outline draws eight hollow, audio-reactive meter columns rather than connecting
the bands into a single contour.

[What's different?](docs/whats-different.md) covers what I added to soundcli, the ideas borrowed from ytkew and Mousiki, and where the radio, search and lyrics features ended up.

## Install

JukeboxCli supports macOS and 64-bit Linux. It needs Node.js 22 or newer, mpv
and ffmpeg.

### Linux

On Arch Linux:

```sh
sudo pacman -S --needed nodejs npm mpv ffmpeg
git clone https://github.com/funstuie-bit/JukeboxCli.git
cd JukeboxCli
./install.sh
jukeboxcli --doctor
jukeboxcli
```

If npm's configured global directory is system-owned, as it normally is with
Arch's npm package, the installer automatically uses `$HOME/.local`. Ensure
`$HOME/.local/bin` is on your `PATH`; the installer prints the installed path.

For other distributions, install Node.js 22+, npm, mpv and ffmpeg, then use the same
source installation commands. See the [Linux install guide](docs/linux-install.md)
for package-manager examples, profile paths and troubleshooting.

Foot uses sharp Sixel artwork automatically. The live visualiser is on by
default on Linux; press `v` in Now Playing to cycle Classic Peak, Smooth, Bass
Mirror, Outline, Bricks and Mosaic. Use `JUKEBOXCLI_VISUALIZER=0 jukeboxcli` if
you prefer the static waveform.

### macOS

The easiest install is the project’s Homebrew formula:

```sh
brew tap funstuie-bit/jukeboxcli https://github.com/funstuie-bit/JukeboxCli.git
brew install funstuie-bit/jukeboxcli/jukeboxcli
jukeboxcli
```

This is the project's own formula, not part of Homebrew's main collection. It builds from source and installs Node, mpv, ffmpeg and yt-dlp. It uses a specific development build, so it won't pick up every commit on GitHub. The [install guide](docs/mac-controls-and-install.md) lists the version it installs.

To install from a clone instead:

```sh
brew install node
git clone https://github.com/funstuie-bit/JukeboxCli.git
cd JukeboxCli
./install.sh
jukeboxcli
```

You need Node 22+ and Homebrew before running the macOS source installer. It installs mpv if needed and builds a command you can run from anywhere (moving the cloned folder won't break it). The app can download its own yt-dlp and ffmpeg copies on first launch.

Check an installation without opening the player:

```sh
jukeboxcli --doctor
```

### Updating

Homebrew install (macOS):

```sh
brew update
brew upgrade jukeboxcli
```

Source install (macOS or Linux):

```sh
cd JukeboxCli
./update.sh
```

`update.sh` refuses to overwrite a checkout with local changes.

Radio also searches the community Radio Browser catalogue. In section **9**,
press **M** for quick channels, **B** for popular stations, **g** for genres/tags,
**c** for countries or **/** to search by station name. Quick choices cover
Lo-fi, Synthwave, Ambient, Chillout, Jazz, Classical, House, Drum & Bass, Reggae
and Rock. They are ordinary Radio Browser tag searches, not bundled or copied
station feeds. Directory results stay temporary until you explicitly save one
with **f**.

## First run

JukeboxCli opens on Home. Search online, browse internet radio or open your local music. You don't need a library or a sign-in to get started.

| Key | Action |
| --- | --- |
| `8`, then `/` | Search online |
| `o` | Play a YouTube or direct audio URL |
| `9` | Open radio and saved stations |
| `9`, then `M` | Browse quick Lo-fi, Synthwave, Ambient, Chillout, Jazz, Classical, House, Drum & Bass, Reggae or Rock channels |
| `9`, then `B`, `g` or `c` | Browse popular radio, genres or countries |
| `9`, then `/` | Search for a station by name |
| `1` | Open the local library |
| `m` or `6` | Open Now Playing |
| `7` | Open the queue |
| `space` | Play or pause; reconnect live radio |
| `?` | Show the full key guide |

Use `A` to append a selected track and `P` to play it next. In the queue, `u` and `D` move an entry, `x` removes it, and `X` clears the queue after confirmation.

![JukeboxCli Home](docs/assets/home.png)

![Now Playing and the editable queue](docs/assets/player.png)

## Artwork and terminals

Ghostty, Kitty-compatible terminals, iTerm2 and Sixel terminals can display
high-resolution cover artwork. Foot selects Sixel automatically, and incremental
screen updates keep the image in place while the player and visualiser move.
This is JukeboxCli running in Ghostty:

![JukeboxCli in Ghostty with cover artwork](docs/assets/ghostty-artwork.png)

Apple's built-in Terminal gets a text drawing instead. It's basic, but the pixelated covers weren't doing much for it. Other terminals without image support still use block artwork.

![JukeboxCli in Apple Terminal with the text fallback](docs/assets/terminal-no-artwork.png)

Press `b` in Now Playing to hide the artwork. You can force the fallback renderer with:

```sh
JUKEBOXCLI_ART=blocks jukeboxcli
```

That also brings back pixel artwork in Apple's Terminal if you prefer it. To use the text drawing in any terminal, run `JUKEBOXCLI_ART=simple jukeboxcli`.

## Downloads and cookies

Choose the audio format, quality, output folder, delays and retry count. You can use cookies from your browser or a Netscape-format `cookies.txt` file.

Settings → Download pacing controls the pause between downloads (1–3 seconds by
default) and retry count. These delays aren't a transfer-speed limit. Cookies
help with access to a source; they don't guarantee faster downloads.

Command-line options apply only to the current launch. Change a preference in
Settings to save it for future launches. Playing and downloading during that
launch use the temporary options; changing an unrelated setting won't save them.

```sh
jukeboxcli --format mp3 --cookies-from-browser chrome:Default "https://..."
jukeboxcli --output-dir ~/Music/MyLibrary --quality 5 @somehandle
```

Run `jukeboxcli --help` for the full list. Spotify support imports music from supported links; it is not Spotify streaming.

## Current status

The current production release is [1.0.4](https://github.com/funstuie-bit/JukeboxCli/releases/tag/v1.0.4). Automated install checks run on Apple Silicon and x64 Linux. Intel Macs and other Linux architectures aren't part of those checks. Known limits below still apply.

A few limits are worth knowing:

- YouTube Music discovery uses an unofficial signed-out API and may need maintenance when YouTube changes it.
- There is no YouTube Music account login, liked-music sync or personalised radio.
- Radio availability, artwork and metadata depend on the station. DRM and general Radio Garden browsing are not supported.
- Online lyrics are optional and coverage varies. Local `.lrc` files work offline.
- macOS system media controls are supplied by mpv, so the system may label the player as mpv.

Saved radio or audio URLs can include private query tokens. Treat your JukeboxCli profile files as private.

## Development

```sh
npm ci
JUKEBOXCLI_HOME="$HOME/JukeboxCli-demo" npm run dev
npm test
npm run typecheck
npm run build
```

The codebase is TypeScript, React and Ink. mpv handles playback; yt-dlp and ffmpeg handle online media and conversion.

The live visualiser is enabled by default on Mac and Linux. Press lowercase `v`
in Now Playing to cycle styles; uppercase `V` controls decorative motion instead. See the
[visualiser notes](docs/visualiser-prototype.md) for how it works and its limits.

More detail:

Settings → yt-dlp updates lets you choose **App-managed nightly**, **App-managed
stable**, or **System / package manager**, including on Homebrew installs.
Startup checks allow up to 60 seconds for a cold yt-dlp launch and report timeout
or process errors if the downloaded copy cannot run.

Homebrew's copy remains the default until you opt in. Selecting an app-managed
channel downloads and checks a separate copy in JukeboxCli's cache; restart to
apply it. Selecting System switches back on the next launch without deleting the
cached copy. Failed updates leave the saved choice unchanged.

This choice affects only yt-dlp: Homebrew still manages mpv and ffmpeg. Automatic
app-managed updates also stage for the next launch, so running downloads and
stream lookups aren't interrupted. `jukeboxcli --doctor` reports the selected
provider, installed app version, requested channel and any pending update, plus
system tools on PATH. See the
[Homebrew and Mac acceptance notes](docs/mac-controls-and-install.md).

- [Feature status](FEATURES.md)
- [Home, profiles and artwork](docs/first-run-and-home.md)
- [Online listening and radio](docs/listening-online.md)
- [Lyrics](docs/lyrics.md)
- [Install and macOS controls](docs/mac-controls-and-install.md)
- [Linux installation](docs/linux-install.md)
- [Architecture](docs/architecture.md)
- [Roadmap](docs/roadmap.md)
- [Changelog](CHANGELOG.md)

Want to change something? Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Credits

JukeboxCli began as a fork of [baairon/soundcli](https://github.com/baairon/soundcli). Its library, playback and download foundations are still here, and the original MIT notice is retained.

[dtDhruv/ytkew](https://github.com/dtDhruv/ytkew) and [itzender5820/mousiki](https://github.com/itzender5820/mousiki) influenced the artwork-led player and queue presentation. [bjarneo/cliamp](https://github.com/bjarneo/cliamp) inspired the classic peak meter, the wider family of visualiser styles and the idea of searching the community Radio Browser directory. Those features and the terminal drawings were implemented for JukeboxCli's own TypeScript/Ink/mpv stack; no source code or assets were copied from those projects.

Released under the [MIT License](LICENSE).
