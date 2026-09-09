# Changelog

## 0.1.0-dev.7 — Screenshot-driven layout polish (2026-09-08)

- Top-align the content-height player with the queue; remove centring and the
  expanding blank gap. Waveform is one/two rows rather than a five-row slab.
- Compact FILE/NET/LIVE TYPE column replaces repeated source prefixes in titles,
  retaining separate selected/playing markers and cell-correct Unicode widths.
- Sidebar, footer and top navigation hints use explicit palette colours; Calm
  also styles navigation chrome, without changing terminal preferences/background.
- No saved-station or playback metadata migration. Old station entries without
  artwork metadata still use the fallback; this is not an artwork repair release.

Verification: 556 tests pass / 4 inherited skipped; typecheck/build/import guard,
terminal radio fixture and isolated real mpv radio/local/mixed-stream checks.
Development branch only; main stays dev.3 pending coordinated promotion.

## 0.1.0-dev.6 — Clearer player and radio presentation (2026-09-08)

- Capped, vertically centred player card beside full-height Playback queue;
  title/artist/broadcast text above bounded artwork, stacked small-window layout.
- Original radio/disc text fallback when artwork is missing; optional decorative
  animation, disabled by default and stopped for paused/hidden/loading views.
- LOCAL/ONLINE/LIVE queue labels, separate selected/playing/paused markers,
  saved-station guidance and duplicate-occurrence feedback without queue deduplication.
- Persisted Lavender/Calm player palette (T), reduced motion (V), and a scrollable
  Settings appearance page. Other app sections/terminal background are unchanged.
- No new dependencies or copied Mousiki assets/code; no lyrics/live spectrum in
  this milestone. Existing music, favourites and queue order are preserved.

Verification: 556 tests pass / 4 inherited skipped; typecheck/build/import guard,
real mpv radio/local/mixed-stream checks and terminal radio fixture. Native screenshot
appearance and fresh Intel/Mac acceptance still need user testing. Development
branch only; main remains dev.3.

## 0.1.0-dev.5 — Website feed detection (2026-09-08)

- Paste station websites or PLS/M3U lists in o/R, then select a discovered feed.
  Static audio/player links only; cancellable 15-second/1-MiB/12-result limits.
  HLS stays a single feed. No script execution, recursive crawling or bulk probes.
- Known DKFM and requested Deeper Shades Radio Garden links; not general Radio
  Garden support. Website-advertised station artwork persists with favourites.
  DKFM's known stream still has no artwork.
- f/t naming starts empty: type replacement or enter to retain current name.
  Rename updates playing/queued radio without reconnecting; same-URL favourites
  retain names on rediscovery. Existing favourites/music are not migrated/deleted.

Verification: 549 tests pass / 4 inherited skipped; full App discovery, cancellation,
naming/restore and isolated real mpv website-to-radio/ICY/reconnect smoke pass.
Development branch only; main remains dev.3.

## 0.1.0-dev.4 — Play URL and internet radio (2026-09-08)

- Global o Play URL and visible 9 Radio / URL. Single YouTube video/Shorts/live
  links, direct HTTP(S) audio and explicit live radio; enter play, A/P queue.
  No downloads or library import required; existing idle/running queues retained.
- Named radio favourites, deduplicated/renamed by URL, atomic private persistence,
  confirmed removal and visible corruption errors; isolated-profile support.
- Live status without duration/seeking/restart; space disconnects/reconnects,
  station-supplied song metadata, no speculative radio prefetch, paused offline
  restore and queue-preserving EOF/disconnect errors. YouTube metadata enrichment
  detects live broadcasts. Direct sources never use browser cookies/yt-dlp.
- Clearer Discover/idle streaming hints; paged, scrollable, terminal-bounded help.
- Fixed immediate-paste field initialisation and one-off playback replacing an
  idle queue. URL validation, credential-free labels and documented persistence.

Verification: 539 tests pass / 4 inherited skipped; full App and real mpv radio,
HTTP mixed-stream and local session checks. Muted real YouTube URL resolution,
metadata and advancing audio also pass. See docs/listening-online.md for details.
No new visualiser/lyrics/account functionality or claimed fresh Intel/Mac acceptance.
Development branch only; main stays at dev.3 for the maintainer's separate-machine test.

## Repository update — 2026-09-08

- GitHub repository renamed to funstuie-bit/JukeboxCli; tested dev.3 history
  promoted to main so default clones and the repository front page are current.
- Package links, overview, clean-Mac setup, screenshot-profile and update
  instructions refreshed. Development branch retained; no music/data migration.
- private mirror remains admin/soundcli-fork with the same history mirrored to main.

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
