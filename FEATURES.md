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
  larger artwork and a taller spectrum in very wide terminals. Queue rows fill
  the panel so selection and time stay aligned with its right edge.
- Live eight-band visualiser for music and radio by default on Linux and macOS,
  with six persistent styles. A static local waveform is available.
- Optional Mac and Linux fullscreen projectM/MilkDrop effects, launched with
  uppercase `F` or from Player appearance; the terminal visualiser continues
  independently. The Mac opt-in installer includes Cream of the Crop presets
  and MilkDrop textures and skips the projectM logo screen.
- Current main's Linux companion selects a real preset before rendering any
  frame, eliminating the brief branded intro. Private Qt 5 frontend build against
  system libprojectM 3.1.12; no compositor shortcut dependency.
- Current main: Classic / Cream of the Crop / combined fullscreen collections,
  with extra presets and textures downloaded only on request. Arch source
  installer includes native dependencies and the basic pack by default, with
  opt-outs and optional browser-cookie dependencies. Not yet in a tagged release.
- Local whole-track waveform; optional local/cached/online lyrics with supplied
  line/word timing, manual matching and a plain-text alternate provider.
- Browser/file cookies for playback and downloads, including detected GNOME
  Keyring decryption for Chromium-family browsers on Linux; no separate Music sign-in.
- Choose system or app-managed yt-dlp independently of mpv/ffmpeg, including on
  Homebrew. App nightly/stable updates are downloaded and startup-checked, then
  applied on restart. Doctor separates provider, requested channel, installed
  version, pending update and system tools.
- macOS media controls through mpv, independent source install and a pinned
  Homebrew source formula.

The quick radio choices search Radio Browser for Lo-fi, Synthwave, Ambient,
Chillout, Jazz, Classical, House, Drum & Bass, Reggae or Rock. They do not copy
or proxy cliamp feeds.

## Experimental and limited

- Mac fullscreen effects need macOS 14.4+, a local optional build and system
  audio-recording permission. They capture only JukeboxCli's mpv audio. Community
  presets vary in GPU cost and compatibility with Apple's OpenGL implementation.
- Linux fullscreen effects capture the active system output, so unrelated audio
  can affect the animation; projectM remains an optional external package.
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
