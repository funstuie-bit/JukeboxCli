# Online listening — dev.5

## Website discovery addition

`player/feeds.ts` validates and inspects HTTP(S) responses with a 15-second abort,
five-request redirect bound, 1-MiB text limit and 12 deduplicated results. Audio
response bodies are cancelled after headers; candidate audio/artwork is not
prefetched. Static audio/source tags, explicit audio links and common player
data attributes/quoted stream fields are recognised. PLS/M3U are expanded once;
HLS stays one feed. No JavaScript execution or nested crawling. Blocked/unsupported
sites produce a direct-feed suggestion rather than a claim of universal support.
Discovery requests use no browser cookies. LAN feeds remain intentionally allowed.

Ibiza Stardust uses its canonical www page and published player data. DKFM root
and /dkfm-2 plus the exact requested Deeper Shades Radio Garden URL have explicit
compatibility mappings verified 2026-09-08; other Garden pages are unsupported.
DKFM and Garden pages were challenge-protected: no bypass is attempted.
Optional og:image station artwork and source website are allowlisted in private
favourites/session metadata. DKFM's known mapping has no artwork; this feature
does not find current-song album art. Legacy favourites still load unchanged.

Listen shows candidate choices, esc cancels, and abandoning the section aborts
pending detection. A new probe replaces unsaved candidates only. Existing exact
URLs keep saved names; different aliases may still produce separate favourites.
f/t accepts replacement text or blank to keep a name; renaming changes current
and queued matching radio titles without reloading audio. Favourites live in 9,
not the downloaded music Library. No automatic duplicate cleanup is performed.

Added parser/network-boundary tests, full-App multi-feed/cancellation/naming tests
and real mpv website→radio discovery plus no-reconnect rename checks in
smoke-radio.ts. Earlier dev.4 implementation and acceptance details follow.

Scope: user-requested Play URL, direct internet radio, favourites and clearer
streaming controls. No library/download mutation, account sign-in, station
directory, personalised YouTube mixes, lyrics or visualiser work in this batch.
Keep this iteration on development while the maintainer tests dev.3 on another Mac.

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

mpv reference checked 2026-09-08:
[metadata and seekable properties](https://github.com/mpv-player/mpv/blob/master/DOCS/man/input.rst).

## Acceptance

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
  cookie settings, never logged. A real YouTube music video passed title
  enrichment, paused/muted load, audio position advance and pause on this M1.
- Existing smoke-listening.ts and smoke-streaming.ts pass unchanged.

Not verified: Intel/clean-Mac acceptance, real broadcaster matrix, authenticated
radio, every HLS codec, or new screenshot appearance. ICY data depends on the
station. No automatic live classification for generic URLs: choose R explicitly.
No new dependencies, native helper or permissions. Artwork pipeline unchanged.
