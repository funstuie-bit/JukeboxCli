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
| Account, likes, radio, lyrics | Planned | Real service acceptance |
| Themes, cover colours, richer artwork | Planned | Capability/resize testing |
| Mouse actions and Vim preset | Planned | Input/focus regression |
| Mac live spectrum and media controls | Feasibility pending | Working Mac prototype |
| Homebrew releases, Intel and Apple Silicon | Planned | Clean Mac matrix |

No ytkew source code has been imported. Waveform is precomputed, not a live spectrum.
Stream history, automatic collection pagination during playback and signed-in
Music API access are not implemented. Streaming uses existing yt-dlp cookie settings.
