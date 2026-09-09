# Lyrics — dev.9 development build

Open the player with `m` (or focus section `6`), then `l` toggles lyrics/queue.
The queue remains intact and keeps its selection. While lyrics are open, arrows
up/down and Page Up/Down scroll lyrics, `f` follows timed lines again. Left/right
still seek 15 seconds; space pauses. `l` no longer seeks in the focused player.
The panel closes when leaving the full-screen player; its online preference persists.

## Sources and privacy

1. Beside a local audio file, try `Song.lrc` first, then `Song.mp3.lrc` (replace
   mp3 with the actual extension). UTF-8, at most 64 KiB, regular files only.
   An existing unreadable/invalid file reports an error rather than silently
   searching online. Local lyrics do not require artist metadata.
2. Successful LRCLIB results cached in the profile's `cache/lyrics-v1.json`
   work offline, including when online lookup is off. Normal installations use
   the legacy soundcli cache directory; `JUKEBOXCLI_HOME` isolates all paths.
3. Press uppercase `L` **in the lyrics panel** to opt into LRCLIB. This persists
   `lyricsOnline: true` in config. Default is false. Lowercase l only opens the
   panel and does not grant network access. Online queries only run while the
   panel is active, after a short debounce; hiding/changing track aborts them.

Online requests send artist, title, optional album and recording duration to
LRCLIB; radio sends parsed artist/title only. Never audio, local filenames,
cookies or library contents. The provider necessarily sees your network address.
No account/key is required. No lyrics are bundled or published by JukeboxCli;
community-supplied lyrics may be missing, incorrect or protected by copyright.

The cache stores up to 64 successful recording matches, newest first, with no
positive expiry; oldest results are evicted. It is disposable, written atomically
with private file permissions; a save failure does not prevent display. Stop
the app and remove only `lyrics-v1.json` to clear it. Local LRC/music files are
never edited. Cache corruption is treated as a miss. No network retries loop
automatically; reopen the panel later after an unavailable/rate-limited result.

## Timing and limits

Basic LRC timestamps, repeated timestamps, millisecond offset and blank timed
gaps are supported. Highlighting uses actual mpv position, follows seeking and
stays still while paused. Plain lyrics or non-mpv playback have no timed
highlight. Up/down browsing suspends automatic scrolling until `f`.

Radio needs exactly one spaced separator in `Artist - Song` (also en/em dash).
Obvious DJ mixes, episodes, sets and ambiguous titles are skipped. This is a
conservative heuristic, not song recognition. Even if the provider returns
timings, radio displays plain text: the broadcast gives no reliable song position.
Station name/logo and DJ show text are not suitable lyric-search metadata.

Missing metadata/results, instrumental recordings and failures have explicit
states. Lines truncate rather than wrap at narrow widths. There is no manual
search/editing, embedded-tag lyrics, word-sync karaoke, translation, YAML
lyricsfile parsing or YouTube transcript scraping. No guarantee of coverage or
correct timing. Large DJ sets should normally stay in the queue/radio view.

## Implementation and verification

`src/player/lyrics.ts` handles bounded parsing, matching and cache/provider I/O.
`LyricsPanel.tsx` owns rendering, scrolling and stale-request cancellation.
Requests use LRCLIB `/api/get`, never fuzzy search, and validate returned artist,
title and (when supplied) duration within two seconds. Album is supplied as a
query constraint, not independently validated. Duration is supplied only within
the documented 1–3600 second range. Response bodies are bounded to 256 KiB;
combined stored lyric text is at most 64 KiB per entry.

Following [LRCLIB API documentation](https://lrclib.net/docs), requests identify
JukeboxCli/version/homepage, are sequential with 300 ms spacing, time out after
8 seconds and honour 429 Retry-After. Exact-match 404s are held in memory for
10 minutes to avoid repeated misses. No scraping, publishing or reporting API.

Tests use invented lyrics and isolated profiles: parser/provider/cache,
configuration opt-in, stale responses/radio/no-sync and responsive panel bounds,
plus full App toggling, seek/pause/follow and queue isolation. Run
`npx tsx scripts/smoke-lyrics.ts` for muted real mpv timing against generated
silence/local LRC. A live provider probe confirmed a timed result and offline
cache reuse without printing lyric text. the maintainer's real-track/terminal acceptance
and independent Intel/Apple Silicon installation checks remain outstanding.
