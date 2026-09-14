# Feature status

These features are in the app now. That doesn't mean every station, terminal
or online service will cooperate. The limits are listed below.

## Supported

- Home with recent local/online plays and saved stations. No library required.
- Local library, playlists, downloads, conversion and custom output folders.
- Signed-out YouTube Music search for songs, videos, albums, artists and playlists.
- Local/online search inside Now Playing: `S`, then `l:`, `s:` or `v:`.
- Mixed local, online and live queue: append, play next, reorder, remove,
  shuffle/repeat and paused session restore. Queue removal never deletes music.
- YouTube/direct audio playback without importing or downloading.
- Browse Radio Browser through ten quick genre channels, popular stations,
  genre/tag, country or station-name search. Save, rename and remove favourites;
  find feeds from websites or PLS/M3U playlists, and refresh station artwork.
  Live pause disconnects; play reconnects.
- Stream/radio listening history and replay from Home.
- Ghostty/Kitty-compatible, iTerm2 and Sixel artwork, including sharp stable
  covers in Foot; a text drawing in Apple's Terminal and blocks elsewhere.
- Lavender, Calm, Ember, Ocean and Forest player themes, plus optional
  decorative motion.
- Responsive player layouts, including a balanced 45/55 player/queue split,
  larger artwork and a taller spectrum in very wide terminals.
- Live eight-band visualiser for music and radio by default on Linux, with six
  persistent styles; macOS remains opt-in. A static local waveform is available.
- Local whole-track waveform; optional local/cached/online lyrics with supplied
  line/word timing, manual matching and a plain-text alternate provider.
- Browser/file cookies for playback and downloads, including detected GNOME
  Keyring decryption for Chromium-family browsers on Linux; no separate Music sign-in.
- App-managed yt-dlp nightly by default, with stable/nightly selection and an
  immediate update action. Read-only doctor reports the managed channel/version
  as well as system tools.
- macOS media controls through mpv, independent source install and a pinned
  Homebrew source formula.

The quick radio choices search Radio Browser for Lo-fi, Synthwave, Ambient,
Chillout, Jazz, Classical, House, Drum & Bass, Reggae or Rock. They do not copy
or proxy cliamp feeds.

## Experimental and limited

- [Audio-reactive visualiser](docs/visualiser-prototype.md): accepted on Intel
  Linux; wider stream, terminal and CPU testing remains useful.
- YouTube discovery uses an unofficial API. Cookies do not supply account APIs.
- Next-track preparation is best effort, not guaranteed gapless playback.
- Radio entries are community-maintained, so availability and metadata vary.
  General Radio Garden browsing, DRM, authenticated feeds and JavaScript
  execution are unsupported.
- Other Linux browser keyrings still use yt-dlp's normal platform detection.
- Artwork and lyrics depend on available metadata and terminal/provider support.
- macOS media controls may appear under mpv's system identity.

## Planned

See the [roadmap](docs/roadmap.md) for release preparation and later ideas.
There's no promised date, and this isn't a complete port of another player.
