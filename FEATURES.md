# Feature status

JukeboxCli is an early Mac-first player. “Supported” describes implemented
behaviour, not a guarantee that every terminal, broadcaster or provider works.

## Supported

- Listening-first Home, recent local/online plays and saved stations.
- Local library, playlists, downloads, conversion and custom output folders.
- Signed-out YouTube Music search for songs, videos, albums, artists and playlists.
- Local/online search inside Now Playing: `S`, then `l:`, `s:` or `v:`.
- Mixed local, online and live queue: append, play next, reorder, remove,
  shuffle/repeat and paused session restore. Queue removal never deletes music.
- YouTube/direct audio playback without importing or downloading.
- Radio favourites, rename/removal, bounded website/PLS/M3U feed detection and
  explicit website artwork refresh. Live pause disconnects; play reconnects.
- Stream/radio listening history and replay from Home.
- Kitty-compatible and iTerm2 inline artwork, half-block fallback, original
  missing-art drawings, Lavender/Calm themes and optional decorative motion.
- Local whole-track waveform; optional local/cached/online lyrics with supplied
  line/word timing, manual matching and a plain-text alternate provider.
- Browser/file cookies for playback and downloads; no separate Music sign-in.
- macOS media controls through mpv, read-only doctor, independent source install
  and a pinned Homebrew source formula.

## Experimental and limited

- [Audio-reactive visualiser](docs/visualiser-prototype.md): isolated prototype,
  parked and not part of Now Playing. The local waveform is not a live spectrum.
- YouTube discovery uses an unofficial API. Cookies do not supply account APIs.
- Next-track preparation is best effort, not guaranteed gapless playback.
- Radio discovery reads static links; general Radio Garden browsing, DRM,
  authenticated feeds and JavaScript execution are unsupported.
- Artwork and lyrics depend on available metadata and terminal/provider support.
- macOS media controls may appear under mpv's system identity.

## Planned

See the [roadmap](docs/roadmap.md) for release preparation and later ideas.
There is no promised timetable or full feature-parity claim with other players.
