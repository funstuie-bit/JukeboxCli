# What makes JukeboxCli different?

JukeboxCli started as a fork of soundcli because I wanted more control over
downloads: which cookies to use, where files go and what format they end up in.
It grew into a player for local music, online tracks and live radio, with ideas
inspired by ytkew and Mousiki along the way.

The guiding idea is simple: **listen first, download only when you choose.**

This page describes how this fork developed from soundcli v1.4.1. It is not a
claim that the latest versions of the other projects lack these features, or
that JukeboxCli implements everything they do.

## The soundcli foundation

[baairon/soundcli](https://github.com/baairon/soundcli) supplied the original
terminal application, local-library and playback foundations, and the download
and import workflows for YouTube, SoundCloud and Spotify links. JukeboxCli builds
on that work rather than claiming those foundations as new.

Spotify links are used for imports and matching, not direct Spotify streaming.
The original [MIT licence notice](../LICENSE) remains intact.

## More control over downloads and files

These were the first reasons for making the fork:

| Addition | What it lets you do |
| --- | --- |
| Browser cookies | Select a browser/profile for yt-dlp playback and downloads, rather than maintain a separate Music login. |
| Cookie files | Use a Netscape-format `cookies.txt` file as an alternative. |
| Custom music location | Choose where downloads are saved, including a different drive. Settings can explicitly move an existing music folder and update library paths. |
| Output templates | Override yt-dlp's filename/folder template for your preferred organisation. |
| Audio formats | Choose best available, MP3, FLAC, WAV, M4A, Opus or Vorbis. |
| Quality and conversion | Set re-encoding quality, choose a yt-dlp format expression, or explicitly convert an existing library. |
| Download pacing | Adjust minimum/maximum delays and retry counts. |
| Config import | Import supported settings from an existing yt-dlp configuration. |
| Settings and CLI options | Change preferences in the interface or override them when launching a download. |

For example:

```sh
jukeboxcli --format mp3 --cookies-from-browser chrome:Default "https://youtube.com/watch?v=..."
jukeboxcli --output-dir ~/Music/MyLibrary --quality 5 "https://youtube.com/watch?v=..."
```

The fork also adds clearer download phases—starting, downloading, converting,
tagging and saved—and handling for repeated source failures and throttling.
Cookies and retries do not guarantee access or bypass service restrictions.
Converting lossy audio to FLAC does not restore quality lost in the source.

## Ideas inspired by ytkew

[dtDhruv/ytkew](https://github.com/dtDhruv/ytkew) helped shape the move toward an
artwork-led listening experience: a dedicated player, more visible playback
controls and an editable queue alongside the current track.

JukeboxCli's implementation adds:

- A responsive player with artwork/details on one side and the queue on the other.
- One queue for local files, online songs and live stations, with append,
  play-next, reorder, remove, shuffle and repeat controls.
- Saved listening sessions that restore paused, including online entries without
  connecting until you press play.
- Inline artwork for supported Mac terminals, plus terminal-friendly fallbacks.
- A precomputed local-track waveform and best-effort next-track preparation.

The local waveform is not a live spectrum, and preparation is not a guarantee
of gapless playback. This is not a complete ytkew port.

## Ideas inspired by Mousiki

[itzender5820/mousiki](https://github.com/itzender5820/mousiki) inspired the
search-without-leaving-the-player workflow and further refinement of the lyrics
presentation and matching experience.

In JukeboxCli, press **S** in Now Playing:

- `l: query` searches local music; a bare query also searches locally.
- `s: query` searches online songs; `v: query` searches videos.
- Enter plays, **A** appends, **P** queues next and **d** explicitly opens the
  download workflow for an online result.
- Escape returns to the previous queue or lyrics panel; music keeps playing.

The lyrics panel uses centred, wrapped text and highlights supplied line or word
timestamps. It does not invent karaoke timing. The audio-reactive visualiser
remains a [separate, parked prototype](visualiser-prototype.md), not a production
feature or a claim of matching Mousiki's visuals.

## Features developed further in JukeboxCli

### Website-to-radio discovery

Paste a station website or PLS/M3U playlist, select an available feed, then play,
queue or save it. Saved stations can be renamed, removed and explicitly refreshed
for website artwork without deleting and recreating them.

Live stations show broadcast metadata when supplied. Pause disconnects; play
reconnects to the live edge. Station logos are not current-song album artwork.

Discovery reads bounded static links, not arbitrary website scripts. There are
specific compatibility mappings for some stations, not a universal Radio Garden
directory or a guarantee that every website works.
[Radio usage and limits](listening-online.md).

### Online discovery without a required account

Discover searches songs, videos, albums, artists and playlists through a
signed-out YouTube Music API. You can also paste a YouTube or direct audio URL.
Playing and queueing do not create a library copy; downloading is a separate choice.
Browser cookies are used for YouTube audio resolution when configured, not for
Music account playlists, liked-music sync or personalised radio.

### More flexible lyrics matching

Local LRC files and cached lyrics work offline. Optional LRCLIB lookup tries exact
metadata first, then conservative remaster/primary-artist matching with a duration
check. Live, remix and edit distinctions are preserved.

Ambiguous results can be selected manually; you can search or retry, and chosen
matches are cached. An explicit lyrics.ovh lookup offers a separate plain-text
fallback. Unknown or mismatched recording timings stay plain rather than showing
misleading synchronisation. Radio lyrics require usable song metadata and are
never presented as synced. Coverage still depends on the providers.
[Lyrics controls and privacy](lyrics.md).

### A Mac-first listening experience

- A listening-first Home screen with the jukebox drawing, recents and stations.
- Replayable history for successfully started online tracks and radio, not just files.
- Lavender/Calm colours and optional decorative motion, disabled by default.
- Ghostty/Kitty-compatible and iTerm2 image rendering. JukeboxCli also
  defaults Apple's Terminal to a simple disc/radio drawing, with pixel art optional.
- mpv-backed macOS media controls, installer dependency checks and read-only doctor
  diagnostics. Automated installation checks focus on Apple Silicon.

## Credit, not a claim of ownership

soundcli is the codebase this project was forked from. ytkew and Mousiki are
credited inspirations; their source code and assets were not copied into this
fork. The player features inspired by them and the terminal drawings were
implemented here. Libraries and external services retain their own authorship.

See [feature status](../FEATURES.md) for current limits and the
[changelog](../CHANGELOG.md) for changes, including work not yet released.
