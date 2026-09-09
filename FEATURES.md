# JukeboxCli feature status

This development branch is separate from the installed soundcli command.

| Capability | Status | Acceptance still needed |
|---|---|---|
| Downloads, cookies, formats, pacing, conversion | Inherited | Fresh Mac regression |
| JukeboxCli command and isolated profiles | Implemented | Clean installation |
| Visible player navigation and editable queue | Implemented; App tests and the maintainer's quick test pass | Broader terminal matrix |
| Saved listening sessions | Implemented; real mpv smoke passes | Intel/Mac matrix |
| Streaming and next-track preload | Implemented; real mpv HTTP/mixed-queue smoke passes | Wider codecs/networks; not universally gapless |
| YouTube Music search and browsing | Implemented signed out; search/browse/pagination probes | the maintainer's online workflow; unofficial API can change |
| Local/YouTube search bar inside Now Playing | Planned, non-urgent; [scope and sequence](docs/roadmap.md) | Input routing, panel restoration, play/queue/download actions; no implicit downloads |
| Play URL: single YouTube item / direct HTTP(S) audio | Implemented dev.4; full App + muted real YouTube playback pass | Fresh Mac/network matrix |
| Direct internet radio, saved favourites, live transport/metadata | Implemented dev.4; real HTTP/ICY/mpv smoke passes | the maintainer's stations; broadcaster/codec variability |
| Paged help and streaming entry hints | Implemented dev.4; full App including 60×18 tests | the maintainer's usability check |
| Website/PLS/M3U feed detection, station artwork, easier naming | Implemented dev.5; bounded static discovery and known DKFM/Deeper Shades links | the maintainer's station-site tests; DKFM artwork unavailable |
| Refresh existing station/queue artwork; visible x/d removal | Implemented dev.8; exact-URL metadata refresh preserves names/audio | the maintainer's end-to-end website refresh check |
| Optional local LRC / offline cache / opt-in LRCLIB lyrics | Implemented dev.9 on development; App tests, live lookup and real mpv timing | the maintainer's tracks/terminal acceptance; coverage varies |
| Smarter matching, manual lyrics search/selection/retry, explicit lyrics.ovh plain lookup | Implemented dev.10; live Oasis normalised match/offline cache and alternate provider checked | Wider recording/provider coverage |
| Centred/wrapped focused lyrics and enhanced-LRC word highlighting | Implemented dev.10; supplied timestamps only, radio/mismatches stay plain | the maintainer's visual acceptance; no guaranteed online word-timed catalogue |
| Separate YouTube Music sign-in/sign-out | Removed from scope at the maintainer's request | Existing browser-cookie playback/download workflow retained |
| Account playlists/likes, personalised YouTube radio | Unimplemented; deferred | Cookies alone do not implement these API features; no new sign-in work planned |
| Top-aligned compact player, radio/disc fallback, queue source column, slim waveform | Implemented dev.7; responsive/App tests pass | the maintainer's visual acceptance |
| Sharp artwork and half-block fallback | Implemented; Ghostty protocol/lifecycle tested | Visual screenshot/other terminal matrix |
| Lavender/Calm player and navigation palettes, reduced-motion setting | Implemented dev.7; persisted, default motion off | the maintainer's terminal colour check |
| App-wide/cover-derived colours, iTerm2/sixel | Planned | Capability/resize testing |
| Mouse actions and Vim preset | Planned | Input/focus regression |
| Mac audio-reactive band visualiser | Isolated dotted-contour prototype; [scope/results](docs/visualiser-prototype.md) | Non-blocking polish; not in Now Playing yet; integration and wider Mac/stream acceptance |
| Mac native media controls | Feasibility pending | Separate from visualiser |
| Homebrew releases, Intel and Apple Silicon | Planned | Clean Mac matrix |

No ytkew source code has been imported. Waveform is precomputed, not a live spectrum.
Stream history, automatic collection pagination during playback and signed-in
Music API access are not implemented. YouTube streaming uses existing yt-dlp cookie settings;
direct audio/radio does not. No station directory, DRM, general Radio Garden support,
script execution or nested playlist crawling. Main now includes the tested dev.8 build;
new work continues on development. Rebuilding this development checkout updates
its locally linked jukeboxcli command, not a separate machine's main checkout.
