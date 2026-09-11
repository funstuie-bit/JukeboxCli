# Lyrics

Press `m` to open the player (or focus section `6`), then `l` for lyrics.
Online lookup starts off. Press uppercase `L` inside the lyrics panel to enable
it; opening the panel alone won't search the internet.

Press `l` again to return to the queue.
The queue remains intact and keeps its selection. While lyrics are open, arrows
up/down and Page Up/Down scroll lyrics, `f` follows timed lines again. Left/right
still seek 15 seconds; space pauses. `l` no longer seeks in the focused player.
The panel closes when leaving the full-screen player; its online preference persists.

`/` opens editable LRCLIB search. Enter submits, up/down or Page Up/Down chooses
a recording (artist/title/album/duration shown), Enter selects, Esc cancels.
`R` retries automatic lookup, bypassing positive/negative cache but not provider
cooldown. While typing or choosing, global playback/navigation keys are captured;
Esc returns to lyrics, not out of the player. Ctrl+C still quits.

If LRCLIB can't find a match, `O` opens a separate lyrics.ovh search. Edit
`Artist - Song` (one spaced separator); Enter sends it, Esc cancels. Online
lookup must be enabled first. This provider is only contacted when you ask.
It supplies text without recording details or timestamps, so results are
labelled plain/unverified.

## Sources and privacy

1. An explicitly chosen cached result overrides local LRC on subsequent opens;
   otherwise, beside a local audio file, try `Song.lrc` then `Song.mp3.lrc` (replace
   mp3 with the actual extension). UTF-8, at most 64 KiB, regular files only.
   An existing unreadable/invalid file reports an error rather than silently
   searching online. Local lyrics do not require artist metadata.
2. Successful provider results cached in the profile's `cache/lyrics-v1.json`
   work offline, including when online lookup is off. The cache follows the
   selected branded or legacy profile; `JUKEBOXCLI_HOME` isolates all paths.
   See [profiles](first-run-and-home.md#profiles).
3. Press uppercase `L` **in the lyrics panel** to opt into LRCLIB. This persists
   `lyricsOnline: true` in config. Default is false. Lowercase l only opens the
   panel and does not grant network access. Online queries only run while the
   panel is active, after a short debounce; hiding/changing track aborts them.
   Search prompts identify their provider before submission. Opening a prompt
   cancels the prior request; Esc also cancels an in-flight manual search.

Online requests send artist, title, optional album and recording duration to
LRCLIB; radio sends parsed artist/title only. Manual search sends your typed query;
lyrics.ovh receives only the artist/title explicitly submitted to its prompt.
Never audio, local filenames,
cookies or library contents. The provider necessarily sees your network address.
No account/key is required. No lyrics are bundled or published by JukeboxCli;
community-supplied lyrics may be missing, incorrect or protected by copyright.

The cache stores up to 64 successful recording matches, newest first, with no
positive expiry; oldest results are evicted. It is disposable, written atomically
with private file permissions; a save failure does not prevent display. Stop
the app and remove only `lyrics-v1.json` to clear it. Local LRC/music files are
never edited. Cache corruption is treated as a miss. No network retries loop
automatically after provider failures; R retries after an unavailable result,
but rate-limit cooldown still applies. Manual choices are saved under the original
track's metadata signature, not the chosen result's identity. Missing-tag tracks
use a hashed track ID/title key; radio also includes broadcast metadata. Music tags
are never changed. The latest selected result replaces only that cache entry.
R can replace the chosen cache entry with a successful automatic match; a failed
retry leaves the old cached choice intact. Local/cached results need no network.

## Timing and limits

Basic LRC timestamps, repeated timestamps, millisecond offset and blank timed
gaps are supported. Highlighting uses actual mpv position, follows seeking and
stays still while paused. Enhanced LRC `<mm:ss.xx>` timestamps are preserved when
ordered and unambiguous; the current word is underlined. Repeated line timestamps
with ambiguous word offsets fall back to line timing. No inferred karaoke or
letter-by-letter animation. Plain lyrics or non-mpv playback have no timed
highlight. Up/down browsing suspends automatic scrolling until `f`. Follow mode
centres a small neighbourhood (active line and up to two lines either side),
with dimmed context and Unicode-cell-aware wrapping. A long active line is clipped
to the viewport around its current word if necessary; manual scrolling exposes
the rest. Plain lyrics remain scrollable and horizontally centred.

Radio needs exactly one spaced separator in `Artist - Song` (also en/em dash).
Obvious DJ mixes, episodes, sets and ambiguous titles are skipped. This is a
conservative heuristic, not song recognition. Even if the provider returns
timings, radio displays plain text: the broadcast gives no reliable song position.
Station name/logo and DJ show text are not suitable lyric-search metadata.

The panel tells you if metadata or lyrics are missing, the recording is marked
instrumental, or lookup failed. Some songs won't have lyrics; others will have
the wrong text or timing. Word-level timing depends on the supplied data.
There is no lyrics editor, translation, embedded-tag reader, YAML lyricsfile
parser or YouTube transcript scraping. For long DJ sets, the queue/radio view
is usually more useful. Automatic radio lookup requires an exact match, and
manually chosen radio lyrics still won't be shown as synced.

## Matching

Automatic lookup first uses exact artist/title plus album/duration when present.
If unavailable or mismatched, non-radio tracks with a known 1–3600 second duration
try a second lookup without the album, removing **only** remaster labels and
trying the primary artist (before comma/feat credits). Artist/title and duration
within two seconds must still agree. Live/remix/edit/acoustic/unplugged/version
qualifiers are retained. Primary-artist splitting is conservative but not perfect
for band names containing commas; use manual search if needed.

Then LRCLIB search supplies up to 20 candidate recordings. One compatible match
can be accepted; otherwise a picker is shown, with compatible recordings first.
No duration means no automatic relaxed match. Explicitly choosing a different
title/artist/version or an unknown/mismatched duration permits plain lyrics only.
The matched identity is shown in the header and preserved offline. lyrics.ovh
results always remain plain because that API returns text, not recording metadata.

## Implementation and verification

`src/player/lyrics.ts` handles bounded parsing, matching and cache/provider I/O.
`LyricsPanel.tsx` owns rendering, scrolling and stale-request cancellation.
`lyric-layout.ts` wraps terminal cells while retaining word indices.
Requests use LRCLIB `/api/get` and `/api/search`. Album is supplied to exact lookup
as a query constraint, not independently validated. Bodies are bounded to 256 KiB
for a single result and 2 MiB for search; combined stored lyric text is at most
64 KiB per entry. Cache JSON is at most 5 MiB/64 entries and remains compatible
with earlier cache entries. Invalid/missing/duplicate candidate IDs are rejected.

Following [LRCLIB API documentation](https://lrclib.net/docs), requests identify
JukeboxCli/version/homepage, are sequential with 300 ms spacing, time out after
8 seconds per request and honour 429 Retry-After separately per provider origin.
The automatic chain is bounded to three requests, without recursive retries.
Final misses are held in memory for 10 minutes; manual search and R bypass misses,
not cooldown. No direct scraping, publishing or reporting API is implemented.

The alternate endpoint follows the [lyrics.ovh API](https://github.com/NTag/lyrics.ovh#api).
No provider package, Python, account or API key is required. Mousiki's
fetch/search/wrapped presentation informed the design; no source/assets were copied. The additional
provider is plain only; enhanced word timing comes from LRC data when present.

Tests use invented lyrics and isolated profiles: parser/provider/cache,
configuration opt-in, stale responses/radio/no-sync and responsive panel bounds,
plus matching/version/ambiguity/manual cache/alternate-provider isolation and
full App search/edit/select/cancel/retry, transport and queue isolation. Run
`npx tsx scripts/smoke-lyrics.ts` for muted real mpv timing against generated
silence/enhanced LRC. Fixtures use invented text rather than publishing real lyrics.

`FORCE_COLOR=3 npx tsx scripts/visual-lyrics.tsx --auto` runs a six-second,
network-free terminal fixture with invented enhanced lyrics in an isolated temp
profile. It exercises centred context, dimming and moving word underlining;
omit `--auto` to inspect/resize interactively and use q to exit. It does not play
audio or enable network access. Real mpv is checked by the separate smoke above.
