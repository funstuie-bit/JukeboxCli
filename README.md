# JukeboxCli

Mac-first terminal music player, evolving the maintainer's soundcli fork. Development branch:
`development`. See [feature status](FEATURES.md) and [architecture](docs/architecture.md).

Build with `npm ci && npm run build`, then `npm start` (or `npm run dev`).
Installation provides `jukeboxcli` and a compatibility `soundcli` alias.
The previous installed soundcli is unchanged until this checkout is installed.

Existing soundcli config/music paths are retained. For an independent profile:
`JUKEBOXCLI_HOME=/absolute/path/to/profile npm start`. This directory holds
config, data, cache, logs and music. Do not run both apps against one profile.
This development build is not yet a verified Intel/Apple Silicon release.

Open **Now Playing** with `6` or `m`, and **Queue** with `7`. These destinations
are visible in navigation. In Library, History or playlist songs, select a song
and press `A` to append or `P` to play next without interrupting the current song.
In Queue: arrows select, enter plays, `u`/`D` moves up/down, and `x` removes only
that queue occurrence (never its file). Space starts an idle queue.
`X` asks to clear the queue and stop; confirm with `y`. Music files stay intact.

The listening queue, position, volume, shuffle and repeat are saved in
`listening-session.json` alongside the library index and restored paused.
Missing library entries/files are dropped. An empty saved queue stays empty.
Artwork loads independently of the waveform. The expanded player shows its
editable queue when space permits; `7` always opens the full queue.

Verification includes full App keyboard/session tests with a fixture audio engine;
real mpv acceptance passes on the development Mac; clean Mac installation is pending.
`npx tsx scripts/smoke-listening.ts` checks real mpv with generated silent audio
in an isolated temporary profile (requires ffmpeg and mpv on PATH).
See [changelog and verification](CHANGELOG.md) for this build's scope and limitations.

### Discover and stream (development build 0.1.0-dev.2)

Press `8` for **Discover**, then `/` to search YouTube Music without signing in.
`[` / `]` switches songs, videos, albums, artists and playlists. Enter streams a
song or opens a collection; `esc` goes back. `L` loads more results when offered.
`A` appends the selected song, `P` queues it next, and `d` opens the existing
download workflow to save it. Streaming itself never adds a file to your library.
A search selection is a one-off in your running queue; playing inside a browsed
collection uses its currently loaded songs as the playback context. Load more
before playing if you want those additional songs included too.

Local files and streams share one queue. `[stream]` marks remote entries; the
player shows **Streaming** or **Saved locally**, plus next-track preparation.
Stream artwork comes from its thumbnail; waveform extraction remains local-only.
Remote queue entries restore paused without a network lookup until you press play.
Only stable page URLs/metadata are saved; expiring audio URLs stay in memory.
History currently lists saved-library plays only, not streamed plays.

Streaming requires **mpv 0.38 or newer** and yt-dlp. Your current browser-cookie
settings are used for audio resolution, separately from signed-out Music search.
First stream resolution can take several seconds (about 16 seconds in one real
test here); restricted/unavailable results may fail. A rejected media URL is
refreshed once; errors keep the queue so you can retry with space or skip with `n`.
No signed-in library, likes, radio or lyrics yet.

The next entry is resolved ahead and appended to mpv for prefetch. “Next prepared”
means queued in mpv, not a guarantee it has buffered all audio. mpv decides when
to read ahead; changing the queue while paused may defer new buffering until play.
Cache limits are 32 MiB forward/4 MiB backward per demuxer; resolved-URL cache is
100 entries with at most five minutes' reuse. This is **not a universal gapless
guarantee** across codecs, long pauses and network conditions.
`npx tsx scripts/smoke-streaming.ts` verifies real HTTP prefetch and mixed-queue
transitions using silent audio and a loopback server, with no library changes.

Own your music. Download your YouTube, SoundCloud, and Spotify libraries to your computer and play them offline, all from your terminal.

**This is a fork of [baairon/soundcli](https://github.com/baairon/soundcli) v1.4.1** with extra features built in: a full first-run wizard, browser/cookie support, total format control, download pacing, custom output location, CLI flags, and a settings screen to change all of it later.

## What this fork adds

### First-run wizard
The first time you run it, a guided setup walks you through everything — every step has **esc to go back**, no dead ends:

1. **Intro** — pick YouTube, SoundCloud, or Spotify
2. **Handle** — type your handle or paste a link
3. **Format** — choose audio format (Best / MP3 / FLAC / WAV / M4A / Opus / Vorbis)
4. **Cookies** — import from browser (auto-detects Chrome / Firefox / Edge / Brave profiles), choose a cookies.txt file, or skip
5. **Output** — where downloads land (defaults to `~/Music/soundcli`; type a new path or press enter)
6. **Loading → Downloading** — grabs your playlists and starts

### Settings (press `5` in the sidebar)
- **Audio format** — change format anytime
- **Cookies** — set up browser cookies, a cookies.txt file, or clear cookies
- **Download pacing** — tune sleep interval, max sleep, retries
- **Import config** — detect and import settings from an existing yt-dlp.conf
- **Convert library** — re-encode your existing downloads to another format in place

### Download resilience
- Live phase per row: **starting → % + speed → converting → tagging → saved** — yt-dlp's post-processing steps are instrumented so rows never sit frozen on "starting"
- Source 403/rate-limit blocks trigger jittered backoff with narrowed concurrency and an honest pause banner, not silent failures
- Failed rows retry (`f`); the bundled yt-dlp self-heals if it goes missing and auto-updates on launch

### Now Playing screen (press `m`, or choose `6 Now Playing`)
A player view with visible navigation (`m` or `esc` closes the expanded view, transport keys stay live):
- **Truecolor cover art** rendered as half-blocks from the embedded art — no `ascii` mush
- **Waveform progress bar** precomputed from the audio's loudness envelope, filled along the accent ramp to the play position
- **Editable queue** — actual play order, selectable and reorderable; use `7` for the dedicated queue view
- Degrades honestly: no embedded art → tidy placeholder; no waveform data → gradient bar; external player → a clear note instead of a fake progress bar

### CLI flags (override config without opening the TUI)
```sh
soundcli --format mp3 --cookies-from-browser chrome:Default "https://..."
soundcli --output-dir ~/Music/MyLibrary --quality 5 @somehandle
soundcli --sleep 2 --max-sleep 10 --retries 10
```

Full list via `soundcli --help`:

| Flag | What it does |
| --- | --- |
| `--format <fmt>` | audio format: best, mp3, flac, wav, m4a, opus, vorbis |
| `--quality <0-10>` | audio quality (0=best, 10=worst) |
| `--yt-format <str>` | raw yt-dlp format string (e.g. `bestaudio[ext=m4a]`) |
| `--output-dir <path>` | where to save downloads |
| `--output-template <tpl>` | yt-dlp `-o` template (overrides folder structure) |
| `--cookies <path>` | cookies.txt file (Netscape format) |
| `--cookies-from-browser <id>` | read cookies from browser (e.g. `chrome:Default`) |
| `--sleep <sec>` / `--max-sleep <sec>` | pacing between downloads |
| `--retries <n>` | retries on failure |
| `--reencode <true\|false>` | force re-encode even if format matches |
| `soundcli <link>` | download that song/playlist on launch |

## Install the development version on a Mac

**One-time setup on the new Mac:**
1. Install Node.js 22 or newer — either from [nodejs.org](https://nodejs.org) or `brew install node@22`
2. Clone and install:
   ```sh
   git clone --branch development https://github.com/funstuie-bit/soundcli-fork.git ~/projects/JukeboxCli
   cd ~/projects/JukeboxCli && ./install.sh
   ```
3. Run it from anywhere:
   ```sh
   jukeboxcli
   ```

On first run the app sets up yt-dlp and ffmpeg (under the default profile,
`~/Library/Caches/soundcli/bin`). Install mpv 0.38+ with `brew install mpv` for
streaming and in-terminal playback. Without mpv, saved files can open in your
default player, but streaming is unavailable.

**What `install.sh` does:** installs locked dependencies, builds, then installs the
package globally. This installs `jukeboxcli` AND replaces the `soundcli` alias.
To retain an existing installation, use `npm start` from this checkout instead.
Homebrew distribution and clean Intel/Apple Silicon acceptance are still planned.

## Dev

```sh
npm install          # Node 22+
npm run dev          # run from source
npm run build        # build dist/
npm test             # isolated unit + App interaction tests
npm run typecheck
```

On macOS, config lives at `~/Library/Preferences/soundcli/config.json` (use `soundcli` itself or the Settings screen to change it). The library index, download queue and listening history live in `~/Library/Application Support/soundcli/`.

## Upstream credit

All the base functionality (TUI, library, player, download queue) is [baairon/soundcli](https://github.com/baairon/soundcli), MIT licensed. This fork adds the wizard, cookie support, format control, pacing, CLI flags, and settings screens described above.
