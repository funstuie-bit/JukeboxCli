# Online listening and radio

## Playing without downloading

Press `8`, then `/`, to search YouTube Music without an account. `[` / `]`
changes between songs, videos, albums, artists and playlists. Enter plays a song
or opens a collection; Escape returns, and `L` loads another page when offered.
Collections use their currently loaded tracks as the playback context.
`A` adds to the end of the queue, `P` plays next and `d` opens the download screen.
Searching, playing and queueing don't save a copy in your library.

From Now Playing, `S` opens music search without stopping playback:

- `l: query` searches local files (also the default for a bare query).
- `s: query` searches online songs; `v: query` searches videos.
- Pasted `/l:` and `/s:` prefixes also work.
- Enter submits, then plays a selected result; `A`/`P` queue and `d` downloads
  online results through the download screen.
- Arrows/Page keys select; `L` loads more online results, `/` edits and Escape
  cancels back to the previous queue/lyrics panel. Results are capped at 200;
  narrow local queries when necessary.

In the player's queue panel, `/` also opens music search. In lyrics, `/`
still searches lyrics, while `S` searches music. Search captures normal
transport/navigation shortcuts until Escape; both player layouts support it.

`o` opens a YouTube/direct audio URL or website prompt. Enter accepts the input;
select the result and Enter plays, `A` appends or `P` queues next. Use
`9` → `R` explicitly for a radio feed or station website. Select a detected
feed and press `f` to save; new favourites are never added automatically.
In Radio / URL, `t` or `f` renames, `x` or `d` asks to remove a saved
station (`y` confirms), and `g` refreshes artwork from its website.
Queue removal is separate: `7` → `x` removes only that listening occurrence.

Live radio shows no seek bar: space disconnects/reconnects at the live edge.
Sessions restore paused, without connecting until you play. For ordinary streams,
mpv 0.38+ and yt-dlp are required for YouTube resolution; direct feeds bypass
yt-dlp and cookies. Browser-cookie settings apply to YouTube playback, not
signed-out discovery. Next-track preparation is best effort, not guaranteed
gapless playback. A rejected media URL is refreshed once; errors retain the queue
so you can retry or skip.

## Refresh a saved station's artwork

Select the station in `9` and press `g`. Paste its website (it's filled in if
already known), then choose a feed. You don't need to delete and re-add the
station. Its saved name stays put and playback doesn't reconnect.

To remove a saved station, use `x` or `d` and confirm with `y`. That's separate
from removing one play of the station from the queue.

### How refresh works

`refreshStations` reads current favourites and atomically merges only supplied
thumbnail/website fields onto exact-URL matches. It validates before writing,
retains names/URLs/missing artwork, adds no new favourites and fails visibly on
corruption/write errors. Listen filters unsaved candidates only after this refresh;
it selects the first returned existing favourite when applicable. No URL aliases
are inferred. `Playback.refreshStationArtwork` updates allowlisted metadata on
matching current/queued radio entries with no engine command or queue-order edit.
The existing session saver persists the enrichment. Aborted probes cannot write.

g opens radio input for a station website (prefilled if known); it does not silently
search other sites. x/d removes with a named confirmation and is in the footer.
Full-App regression seeds an artwork-less favourite, starts it, rediscovers its
website, checks preserved name/enriched session, then cancels/confirms removal.
Real mpv smoke checks metadata refresh does not open another audio connection.

## Finding feeds on a website

`player/feeds.ts` validates and inspects HTTP(S) responses with a 15-second abort,
five-request redirect bound, 1-MiB text limit and 12 deduplicated results. Audio
response bodies are cancelled after headers; candidate audio/artwork is not
prefetched. Static audio/source tags, explicit audio links and common player
data attributes/quoted stream fields are recognised. PLS/M3U are expanded once;
HLS stays one feed. No JavaScript execution or nested crawling. Blocked/unsupported
sites show a suggestion to try a direct feed URL instead.
Discovery requests use no browser cookies. LAN feeds remain intentionally allowed.

Ibiza Stardust uses its canonical www page and published player data. DKFM root
and /dkfm-2 plus the exact Deeper Shades Radio Garden URL have explicit
compatibility mappings; other Garden pages are unsupported.
Challenge-protected pages are not bypassed.
Optional og:image station artwork and source website are allowlisted in private
favourites/session metadata. DKFM's known mapping has no artwork; this feature
does not find current-song album art. Legacy favourites still load unchanged.

Listen shows the feeds it finds. Escape cancels, and leaving the section stops
the lookup. A new search replaces unsaved results only. An exact URL match keeps
the saved name and refreshes any supplied metadata; different URLs for the same
station can still create duplicates.
Use `f`/`t` to type a new name, or leave it blank to keep the current one.
Renaming updates matching playing and queued stations without reloading audio.
Saved stations live in `9`, not the downloaded music Library. The app doesn't
remove duplicates for you.

## Implementation

- `player/url.ts` validates one HTTP(S) URL, rejects URL user/password, control
  characters and PLS/M3U lists; canonicalises supported YouTube video links.
  Direct URL identity is a SHA-256 URL digest; display titles omit path/query.
- `StreamTrack.streamType`: absent/extractor uses yt-dlp; direct/radio bypasses
  extraction and all browser cookies. `isLive` is supplied by radio mode or
  detected from YouTube metadata. Session v2 has optional allowlisted fields;
  existing v1/v2 sessions still read. Direct URLs are user inputs, not ephemeral
  extracted URLs, and therefore persist (query tokens included). Do not publish
  session/favourites files. HTTP endpoints can include explicitly chosen LAN
  services; this is a local desktop player, not a server accepting third-party URLs.
- Resolver metadata enriches a queue occurrence without invalidating play order
  or prefetch. It includes title, artist, duration, thumbnail and live status;
  signed playable URLs and allowed headers stay in the existing memory cache.
- `Playback`: live seek/restart no-op; pause unloads audio, resume resolves/reloads
  at the live edge. No speculative connection for known-live next entries or
  prefetch from a live current entry. Newly resolved YouTube-live entries also
  skip prefetch. EOF/disconnection retains queue and exposes reconnect/skip.
  User-driven next/prev still work. Live session position is always zero and
  restoration never connects. mpv seekable=false also disables finite-stream seeks.
- mpv observes `metadata` and `seekable`. ICY/title text is transient playback
  state, sanitised for display, never a renamed station or library entry.
- `player/stations.ts` uses atomic owner-only JSON writes with a 500-station
  limit, names limited to 120 characters, same-URL rename/deduplication and
  explicit corrupt-file errors. It never silently overwrites invalid data.
- `Listen.tsx`: 9 opens favourites, o opens URL input, R radio input, enter
  accepts then plays, A/P queues, f saves/renames, x removes with confirmation.
  Text/confirmation capture blocks global actions; input is width-bounded.
  Global o intent is consumed so a later 9 doesn't reopen an old form.
- Help is one bounded group per page with scroll; navigation is intercepted
  before playback keys, so browsing help cannot seek the song underneath.

mpv reference:
[metadata and seekable properties](https://github.com/mpv-player/mpv/blob/master/DOCS/man/input.rst).

## Verification and limits

- Unit tests: URL classification/canonicalisation/rejections, cookie-free direct
  resolution/cancellation, atomic favourites/reload/rename/remove/corruption,
  live queue/prefetch/seek/pause/reconnect/EOF/metadata and paused session restore.
- Full App: o/paste/accept/queue, 9/R/f/name/play, player live status, seek-hint
  suppression, reconnect, favourite removal confirmation, restart and queue
  preservation; long URL input and help at 60×18; all earlier workflows retained.
- `npx tsx scripts/smoke-radio.ts`: real mpv, local HTTP endless silent MP3 with
  ICY title, finite direct URL, no speculative radio fetch, disconnect/reconnect,
  station save, offline restore and EOF retention. Generates only temporary
  fixtures. Requires ffmpeg and mpv on PATH.
- `npx tsx scripts/smoke-online.ts URL [config.json]`: optional bounded, muted
  real-service test. Requires existing yt-dlp/mpv on PATH; creates only a private
  temporary profile and symlinks its tool path. Optional config is read only for
  cookie settings, never logged. Use only disposable test cookie settings and
  public test URLs; do not point probes at your personal profile.
- `scripts/smoke-listening.ts` and `scripts/smoke-streaming.ts` cover local
  playback and mixed-queue transitions with generated audio.

Broadcaster availability, HLS codecs, artwork and ICY data vary by source. There
is no automatic live classification for generic URLs: choose R explicitly.
Authenticated/DRM radio and general station-directory browsing are unsupported.
