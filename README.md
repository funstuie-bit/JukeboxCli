# JukeboxCli

Mac-first terminal music player combining an offline library with YouTube Music
discovery and streaming. **This branch: 0.1.0-dev.7** (`development`).
`main` remains at **0.1.0-dev.3** while the maintainer tests the current clean-Mac install.
Built on [soundcli by baairon](https://github.com/baairon/soundcli), with player
design and feature inspiration from [ytkew by dtDhruv](https://github.com/dtDhruv/ytkew).
See [upstream credit](#upstream-credit) for how each project contributes.

- Search songs, videos, albums, artists and playlists without signing in.
- Mix streams and saved tracks in an editable, persistent listening queue.
- Play a YouTube/audio URL or live radio without downloading; save favourite stations.
- Sharp artwork, two-panel player, waveform, shuffle/repeat and next-track preparation.
- Download/import controls for YouTube, SoundCloud and Spotify links, including
  cookies, formats, pacing and conversion. Spotify imports are not Spotify streaming.

[Install on a Mac](#install-the-development-version-on-a-mac) ·
[Feature status](FEATURES.md) · [Changelog](CHANGELOG.md) · [Architecture](docs/architecture.md)

New screenshots are being prepared from a clean installation. Account/likes,
personalised YouTube radio, lyrics and a verified Intel/Apple Silicon release remain in development.

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
Artwork loads independently of the waveform. Wider screens have two full-height
bordered panels: cover/track/transport left, editable queue right. Artist, title
and duration have separate columns where space permits, with a solid selection
highlight and distinct playing marker. Smaller windows use a compact stacked
layout; `7` always opens the full queue.

### Artwork and player layout (0.1.0-dev.7)

The player now puts station/song information above a compact artwork area,
alongside a clearly named **Playback queue**. The player card is top-aligned with
the queue and fits its content, with artwork capped at 32 columns × 12 rows;
smaller windows stack details
over the queue. Radio can show up to three lines of broadcast information when
space allows. Missing covers use an original terminal-drawn radio/disc fallback,
not an empty cover box or a claim of real station artwork.

In the player, **T** switches Lavender/Calm colours; **V** toggles decorative
fallback motion. These choices persist, also available in **5 Settings → Player
appearance** (scroll down). Reduced motion is **on by default**. Animation stops
when paused, hidden, loading or the graphic is too small; it is not audio-reactive.
Themes apply to the player/queue, sidebar and navigation hints, not the terminal
background or every app section. Navigation uses explicit readable colours rather
than inheriting the terminal's default text colour.

Queue entries have a compact **TYPE** column: **FILE** (local), **NET** (online)
or **LIVE**. Titles no longer repeat bracketed source labels. **›** marks your selection,
**▶** the playing entry and **Ⅱ** the paused entry. Repeated queue entries remain
allowed: adding an existing item says “Already queued · added another occurrence”.
These are not duplicate favourites; saved stations stay in **9 Radio / URL**.

Ghostty and compatible terminals display a real PNG, up to 1024 pixels on its
longest side, not a tiny text mosaic. The app probes Kitty image support and
character-cell dimensions first. Original proportions are preserved: a wide
YouTube thumbnail stays wide. Online results use the largest supplied thumbnail.
Old queued streams can retain their earlier thumbnail; search/select again to
refresh their metadata.

Press `b` in the player to hide/show artwork (view-local toggle). Images disappear
behind help and on screen changes, and reposition after resize. Unsupported
terminals, missing size replies and tmux/screen use proportional half-blocks.
Force fallback with `JUKEBOXCLI_ART=blocks jukeboxcli`. Native iTerm2/sixel image
renderers are not implemented yet. After changing terminal fonts, restart if
their character proportions differ; ordinary window resizing works live.

The default palette is now lavender/blue with explicit readable player text.
The slim one/two-row **TRACK WAVEFORM** shows precomputed loudness, not a live spectrum.
Streaming shows progress without downloading the whole song for visualisation.
Cover-derived themes and live Mac spectrum remain future work. A trailing
`;1994`-style year is tidied for display only; stored metadata/files stay intact.

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
For YouTube, only stable page URLs/metadata are saved; extracted expiring audio URLs stay in memory.
History currently lists saved-library plays only, not streamed plays.

Streaming requires **mpv 0.38 or newer** and yt-dlp. Your current browser-cookie
settings are used for audio resolution, separately from signed-out Music search.
First stream resolution can take several seconds (about 16 seconds in one real
test here); restricted/unavailable results may fail. A rejected media URL is
refreshed once; errors keep the queue so you can retry with space or skip with `n`.
No signed-in library, likes, personalised YouTube radio or lyrics yet. Direct
internet radio is available in dev.4 as described below.

The next entry is resolved ahead and appended to mpv for prefetch. “Next prepared”
means queued in mpv, not a guarantee it has buffered all audio. mpv decides when
to read ahead; changing the queue while paused may defer new buffering until play.
Cache limits are 32 MiB forward/4 MiB backward per demuxer; resolved-URL cache is
100 entries with at most five minutes' reuse. This is **not a universal gapless
guarantee** across codecs, long pauses and network conditions.
`npx tsx scripts/smoke-streaming.ts` verifies real HTTP prefetch and mixed-queue
transitions using silent audio and a loopback server, with no library changes.

### Play URL and internet radio (0.1.0-dev.5)

**No library import required.** Press **o** from any normal screen to paste a
YouTube video or direct HTTP(S) audio URL. Enter accepts the link; **enter again
plays**, **A** appends or **P** queues it next without interrupting playback.
YouTube watch, shortened, Shorts and live links resolve title/artist/artwork
when played. Playlist/channel URLs belong in **8 Discover**, not Play URL.
Opening a one-off link keeps an existing queue, even if it hasn't started yet.

Press **9** for **Radio / URL**, then **R** to paste a station website, direct
feed or PLS/M3U playlist. **o** also accepts websites. Detection lists available
feeds: select one and press enter to play, A/P to queue or **f** to save.
Press esc to cancel detection. Nothing is saved until you choose to save it.
Favourites reappear in 9 after restart. **t** (or **f**) renames a saved station:
type a replacement directly, or enter keeps its current name. **x** asks
to remove a favourite (or dismisses an unsaved link). Removing a favourite
doesn't stop playback, remove queue entries or touch music files.

Radio entries show **LIVE**, with no track duration/progress bar or seek/restart.
**Space disconnects; space again reconnects to the live broadcast**, rather
than resuming an old buffer. Station-supplied current-song metadata appears in
the player when available. A detected live YouTube broadcast uses the same live
transport rules. Radio sessions restore disconnected and paused, with no
network lookup until play. A dropped/ended broadcast keeps the queue and offers
space to reconnect or n to skip. Live entries aren't opened speculatively for
prefetch; repeat/shuffle still apply to queue navigation, not radio seeking.

Direct audio/radio uses mpv without yt-dlp or browser cookies. HTTP(S) audio and
HLS endpoints are supported when mpv can decode them. Website detection reads
static audio/player links and optional website artwork, without running scripts.
Ibiza Stardust's site is supported; DKFM and the requested Deeper Shades Radio
Garden link have explicit known-feed mappings. This is **not general Radio Garden
support**. Other protected/JavaScript-only pages may need a direct feed.
Station artwork is retained when advertised; DKFM's known feed currently has no
artwork, and station artwork is not current-song album art. There is no station
directory search, nested playlist crawling or authenticated/DRM playback.
Detection is bounded to 15 seconds, 1 MiB and 12 results; audio responses are
closed after inspecting headers. Only the selected feed is played.
Use **R**, not ordinary audio URL
mode, for live stations; unknown direct URLs cannot reliably be classified as
live automatically. Availability/geoblocking depends on the broadcaster.

Favourites live in `radio-stations.json` beside `listening-session.json`, not
the music index. Both are written owner-only and honour `JUKEBOXCLI_HOME`.
**User-supplied direct URLs are saved verbatim apart from URL normalisation**,
including query tokens if present: use trusted links and don't share these
files publicly. Embedded username/password URLs are rejected. Extracted
YouTube media URLs/headers remain memory-only. Streams never enter download
jobs or saved-library history merely by playing/queueing them.

Help (**?**) is now paged: **[ / ]** changes group, **up/down** scrolls and
**? / esc** closes. Radio/Discover open on their own help group. See the
[online listening implementation and acceptance notes](docs/listening-online.md).

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
- **Sharp cover art** through Kitty graphics where probed, with a half-block fallback
- **Multi-row waveform** from the track's loudness envelope, with separate playback progress
- **Editable queue** — actual play order, selectable and reorderable; use `7` for the dedicated queue view
- Degrades honestly: no embedded art → placeholder; no waveform → progress line; external player → a clear note

### CLI flags (override config without opening the TUI)
```sh
jukeboxcli --format mp3 --cookies-from-browser chrome:Default "https://..."
jukeboxcli --output-dir ~/Music/MyLibrary --quality 5 @somehandle
jukeboxcli --sleep 2 --max-sleep 10 --retries 10
```

Full list via `jukeboxcli --help` (`soundcli` remains a compatibility alias):

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
| `jukeboxcli <link>` | download that song/playlist on launch |

## Install the development version on a Mac

**One-time setup on the new Mac:**

1. Install Node.js 22 or newer and mpv 0.38+. With Homebrew: `brew install node mpv`.
   Ghostty is recommended for sharp artwork; other terminals use the fallback.
2. Clone and install:
   ```sh
   mkdir -p ~/projects
   git clone https://github.com/funstuie-bit/JukeboxCli.git ~/projects/JukeboxCli
   cd ~/projects/JukeboxCli && ./install.sh
   ```
3. Run it from anywhere:
   ```sh
   jukeboxcli
   ```

The instructions above install `main` (dev.3). To test **dev.7 separately**,
clone the development branch into a different folder and use `npm start`;
this does not replace the installed command:

```sh
git clone --branch development https://github.com/funstuie-bit/JukeboxCli.git ~/projects/JukeboxCli-next
cd ~/projects/JukeboxCli-next
npm ci && npm run build
JUKEBOXCLI_HOME="$HOME/JukeboxCli-next-profile" npm start
```

Keep the same `JUKEBOXCLI_HOME` for subsequent launches of that test profile.

On first run the app sets up yt-dlp and ffmpeg (under the default profile,
`~/Library/Caches/soundcli/bin`). Install mpv 0.38+ with `brew install mpv` for
streaming and in-terminal playback. Without mpv, saved files can open in your
default player, but streaming is unavailable.

**What `install.sh` does:** installs locked dependencies, builds, then installs the
package globally. This installs `jukeboxcli` AND replaces the `soundcli` alias.
To retain an existing installation, use `npm start` from this checkout instead.
Homebrew distribution and clean Intel/Apple Silicon acceptance are still planned.

On the welcome screen, press **esc** to skip importing a library. Then **8** opens
Discover, **/** starts search, **A/P** adds songs to the queue and **m** opens the
player. Use a wide window for the two-panel layout. You do not need old library
data or personal credentials to browse public search results.

For clean screenshots on a Mac that already has soundcli data, use a separate
profile: `JUKEBOXCLI_HOME="$HOME/JukeboxCli-demo" jukeboxcli`. Keep that same
setting for subsequent launches of the demo profile. Existing music is untouched.

## Update an existing JukeboxCli checkout

The GitHub repository was renamed from `soundcli-fork` to `JukeboxCli`; history
and the compatibility data paths are preserved. New clones use `main` by default.

```sh
cd ~/projects/JukeboxCli
git pull --ff-only
npm ci
npm run build
jukeboxcli --version
```

If you cloned the earlier development branch, it is retained and updated too.
To move a clean checkout onto main, run `git fetch` then `git switch main` before
the update commands. If Git reports local changes or divergence, preserve those
changes first; do not force-reset. An old remote URL can be updated with
`git remote set-url origin https://github.com/funstuie-bit/JukeboxCli.git`
(use your actual GitHub remote name if it is not `origin`).

The global command normally links to this checkout: rebuilding updates its next
launch. If you moved the checkout, rerun `./install.sh`. Keep a copy of the config
and data directories below before changing versions; music is not removed by updates.

## Dev

```sh
npm ci               # Node 22+, locked dependencies
npm run dev          # run from source
npm run build        # build dist/
npm test             # isolated unit + App interaction tests
npm run typecheck
```

On macOS, config lives at `~/Library/Preferences/soundcli/config.json` (use `soundcli` itself or the Settings screen to change it). The library index, download queue and listening history live in `~/Library/Application Support/soundcli/`.

## Upstream credit

JukeboxCli owes its foundation and direction to these projects and their contributors:

- **[soundcli — baairon](https://github.com/baairon/soundcli):** the original
  MIT-licensed codebase this project is forked from. Its terminal interface,
  library, playback and download queue form JukeboxCli's foundation. The original
  copyright and licence notice is retained in [LICENSE](LICENSE).
- **[ytkew — dtDhruv](https://github.com/dtDhruv/ytkew):** inspiration for the
  artwork-led Now Playing screen and the richer listening experience, including
  queue interaction and online discovery. These features are independently
  implemented for JukeboxCli's TypeScript/Ink/mpv stack; no ytkew source code is
  included, and this is not a claim of complete feature parity.

- **[Mousiki — itzender5820](https://github.com/itzender5820/mousiki):** visual
  inspiration for the compact player, configurable presentation and decorative
  missing-art fallback. Our terminal drawings and implementation are original;
  no Mousiki code/assets or audio engine are included.

Thank you to the authors and their contributors for sharing their work.
