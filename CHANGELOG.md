# Changelog

## 0.1.0-dev.3 — player presentation (2026-09-07)

- Two-panel player: artwork/details/waveform left, full-height editable queue
  right. Artist/title/duration columns, solid selection, slate borders and
  lavender/blue player text; compact layout on smaller screens.
- Kitty PNG artwork after protocol and cell-size probes; longest edge 1024px,
  original proportions preserved, largest online thumbnail preferred. Block
  fallback uses contain/padding instead of cropping; b toggles artwork.
- Image cleanup across help, embedded/expanded player switches, resize and exit.
  Chunked/cached PNG transmission, placements after Ink redraw, cursor preserved.
  tmux/screen fall back safely.
- Multi-row whole-track waveform with separate progress. Trailing semicolon/year
  tidied for display only; no library/file mutation.

Verification: 515 tests pass, 4 inherited skipped; typecheck/build/import guard
clean. Both real mpv local/session and HTTP mixed-stream smoke tests pass.
Coverage includes layout/columns/protocol/lifecycle and full App workflows.
Real Ghostty confirms Kitty support and sends a 1024×576 cover; a fixture cycles
visible→hidden→visible correctly. macOS denied automated window screenshots,
so final visual appearance needs the maintainer's acceptance, not a claimed screenshot check.
The fixture is read-only and does not play or download music.

Pending: cover-derived theme selection, native iTerm2/sixel artwork, live Mac
spectrum. This is a visual pass, not the account/radio/lyrics milestone.

## 0.1.0-dev.2 — streaming and public discovery (2026-09-07)

- Visible Discover (8): signed-out YouTube Music search, five result types,
  album/artist/playlist browsing, pagination, stream/queue/download actions.
- Mixed local/remote queues, next-track preparation through mpv, cancellable URL
  resolution, one refresh on rejected media URLs and visible retry/skip errors.
- Stream thumbnails, explicit saved/streaming state and remote session v2 restore
  without network access until play. v1 sessions remain readable; music is unchanged.
- Corrected numbered navigation inside drill-downs and stale next-ready status.

Verification: 504 tests passed, 4 inherited skipped; typecheck/build/distribution
import guard clean, runtime npm audit zero findings. Real mpv 0.41 on this Mac passed silent HTTP prefetch with per-file
headers, stream→stream→local automatic transitions exactly once, next-entry edits
and prepared skip. Existing real local restore/transport smoke also passes.
A real public YouTube Music song loaded paused/muted through yt-dlp in ~16 seconds.
Automated App tests cover search/browse/pagination/queue/stream/paused reopening;
provider-boundary tests include the service's distinct continuation shelf shape.

Limits: mpv 0.38+ required for streaming. Preparation is not a buffered/gapless
guarantee. Search is signed out; account/likes/radio/lyrics and streamed history
remain future work. Collections queue currently loaded songs only. No clean-Mac
or Intel acceptance claimed; existing cookies/import controls remain unchanged.

## 0.1.0-dev.1 — first JukeboxCli development build (2026-09-07)

- Visible Now Playing (6/m) and Queue (7), persistent shortcut hints and JukeboxCli branding.
- Append/play-next from track lists; select, reorder, remove and confirmed clear in the listening queue. No music deletion from queue actions.
- Queue, order, position, volume, shuffle and repeat restored paused; missing files dropped and moved files resolved through the library.
- Cover loads independently of waveform; editable queue replaces the passive up-next list. Dedicated Queue remains available in smaller windows.
- mpv loads wait for file-loaded; pause is applied before load. Pending loads are cancelled on stop/quit.
- Independent JUKEBOXCLI_HOME profiles and isolated test storage. Existing soundcli paths remain the compatibility default.
- Dependency audit findings resolved in the lockfile. Distribution import check uses syntax parsing instead of matching UI strings.

Verified: 492 tests pass, 4 inherited skipped; typecheck/build/import guard clean;
real mpv smoke with silent generated fixtures covers paused restore, position,
volume, shuffle/repeat, next/pause and queue restart after clearing. Full App tests
exercise keyboard controls, queue editing, session reopening and 60×18 resize.

Not a full ytkew port or public Mac release. Streaming/search/account/radio/lyrics,
themes, advanced artwork, mouse/Vim options, native Mac integrations and clean
Intel/Apple Silicon installation remain on the feature checklist. No gapless claim.
