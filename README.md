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

Listening-queue foundation supports non-interrupting append/play-next, reordering,
removing individual occurrences, and versioned session storage. UI wiring is in progress.

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

### Now Playing screen (press `m`)
A full-screen player view, toggled from any section (`m` or `esc` closes, transport keys stay live):
- **Truecolor cover art** rendered as half-blocks from the embedded art — no `ascii` mush
- **Waveform progress bar** precomputed from the audio's loudness envelope, filled along the accent ramp to the play position
- **Up next** — the shuffle-aware upcoming list
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

## Install on any Mac

**One-time setup on the new Mac:**
1. Install Node.js 22 or newer — either from [nodejs.org](https://nodejs.org) or `brew install node@22`
2. Clone and install:
   ```sh
   git clone https://github.com/funstuie-bit/JukeboxCli.git ~/Developer/soundcli-fork
   cd ~/Developer/soundcli-fork && ./install.sh
   ```
3. Run it from anywhere:
   ```sh
   soundcli
   ```

That's it — on first run soundcli downloads yt-dlp and ffmpeg itself (into `~/Library/Caches/soundcli/bin`), so no other dependencies are needed. mpv for in-terminal playback is optional: `brew install mpv` (without it, tracks open in your default player).

**What `install.sh` does:** `npm install`, `npm run build`, `npm install -g .` — which puts a global `soundcli` command on your PATH.

## Dev

```sh
npm install          # Node 22+
npm run dev          # run from source
npm run build        # build dist/
npm test             # 480 tests
npm run typecheck
```

On macOS, config lives at `~/Library/Preferences/soundcli/config.json` (use `soundcli` itself or the Settings screen to change it). The library index, download queue and listening history live in `~/Library/Application Support/soundcli/`.

## Upstream credit

All the base functionality (TUI, library, player, download queue) is [baairon/soundcli](https://github.com/baairon/soundcli), MIT licensed. This fork adds the wizard, cookie support, format control, pacing, CLI flags, and settings screens described above.
