# Online listening — dev.4

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
