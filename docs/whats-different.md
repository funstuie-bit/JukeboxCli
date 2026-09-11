# What makes JukeboxCli different?

JukeboxCli started as a fork of soundcli because I wanted more control over
downloads: which cookies to use, where files go and what format they end up in.
It grew into a player for local music, online tracks and live radio, with ideas
inspired by ytkew and Mousiki along the way.

I wanted to play something without having to download it first. Saving a copy
should be a choice, not the price of listening.

This page compares the fork with soundcli v1.4.1, where it started. It's not a
review of the other projects' latest versions, or a claim that I've ported
everything they do.

## The soundcli foundation

[baairon/soundcli](https://github.com/baairon/soundcli) supplied the original
terminal app, library, playback, downloads and imports from YouTube, SoundCloud
and Spotify links. Those came from soundcli. They aren't new features I built.

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

Downloads now show which stage they're at: starting, downloading, converting,
tagging or saved. There is also handling for repeated failures and throttling.
Cookies and retries do not guarantee access or bypass service restrictions.
Converting lossy audio to FLAC does not restore quality lost in the source.

## Ideas inspired by ytkew

[dtDhruv/ytkew](https://github.com/dtDhruv/ytkew) gave me ideas for the player
screen: put the artwork where you can see it, make the controls obvious and
keep an editable queue beside the current track.

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

[itzender5820/mousiki](https://github.com/itzender5820/mousiki) made searching
without leaving the player look useful. Its lyrics worked well too, which
prompted another look at how JukeboxCli finds and displays them.

In JukeboxCli, press **S** in Now Playing:

- `l: query` searches local music; a bare query also searches locally.
- `s: query` searches online songs; `v: query` searches videos.
- Enter plays, **A** appends, **P** queues next and **d** opens the
  download screen for an online result.
- Escape returns to the previous queue or lyrics panel; music keeps playing.

The lyrics panel uses centred, wrapped text and highlights supplied line or word
timestamps. It does not invent karaoke timing. The audio-reactive visualiser
remains a [separate, parked prototype](visualiser-prototype.md), not a production
feature or a claim of matching Mousiki's visuals.

## Features developed further in JukeboxCli

### Find radio feeds from a website

Paste a station website or PLS/M3U playlist, select an available feed, then play,
queue or save it. Rename or remove saved stations, or refresh their website
artwork without deleting and adding them again.

Live stations show broadcast metadata when supplied. Pause disconnects; play
reconnects to the live edge. Station logos are not current-song album artwork.

It checks a limited number of links in the page, without running website scripts.
A few stations have specific compatibility fixes. It won't browse the whole
Radio Garden directory, and some websites won't work.
[Radio usage and limits](listening-online.md).

### Search online without an account

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
matches are cached. You can also try lyrics.ovh for plain text. If the recording
timing is unknown or doesn't match, the app won't pretend the lyrics are synced.
Radio needs usable song metadata and always shows plain lyrics. Some tracks
still won't have a match (and plenty of mine are instrumental anyway).
[Lyrics controls and privacy](lyrics.md).

### The Mac bits

- A Home screen with the jukebox drawing, recents and stations.
- Replayable history for successfully started online tracks and radio, not just files.
- Lavender/Calm colours and optional decorative motion, disabled by default.
- Ghostty/Kitty-compatible and iTerm2 image rendering. JukeboxCli also
  defaults Apple's Terminal to a simple disc/radio drawing, with pixel art optional.
- mpv-backed macOS media controls, installer dependency checks and read-only doctor
  diagnostics. Automated installation checks focus on Apple Silicon.

## Credits

soundcli is the codebase this project was forked from. ytkew and Mousiki are
credited inspirations; their source code and assets were not copied into this
fork. The player features inspired by them and the terminal drawings were
implemented here. Libraries and external services retain their own authorship.

See [feature status](../FEATURES.md) for current limits and the
[changelog](../CHANGELOG.md) for changes, including work not yet released.
