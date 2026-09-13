# Changelog

Release notes describe what changed in each build. For what works now and the
remaining limits, see [feature status](FEATURES.md).

## Unreleased

- Give very wide player screens a balanced 45/55 split, artwork up to 56
  columns × 24 rows, aligned panel bottoms, a taller spectrum and queue rows
  capped for easier scanning. Outline draws distinct hollow band meters instead
  of a long stepped contour.
- Put wide player and queue shortcuts in one shared footer below the divider,
  separated by `│`; queue confirmations and errors stay inside its panel.
- Add Radio Browser under `9`: browse popular stations, genres/tags or countries,
  or search by station name. Results stay temporary until explicitly saved.
- Fix `B` popular browsing: preserve its intentional blank query instead of
  accidentally searching Radio Browser for a station named `Untitled`.
- Show the real eight-band visualiser for live radio, and restore Sixel station
  artwork after a changing broadcast-metadata row erases its terminal cells.
- Use sharp Sixel artwork automatically in Foot. Incremental screen updates keep
  unchanged image rows stable while the player and visualiser animate; block
  artwork remains available as a compatibility override.
- Enable the hands-on accepted live visualiser by default on Linux. Lowercase
  `v` cycles Classic Peak, Smooth, Bass Mirror, Outline, Bricks and Mosaic;
  `JUKEBOXCLI_VISUALIZER=0` restores the static waveform. macOS remains opt-in.
- Detect Chrome, Chromium, Edge, Brave and Firefox cookie profiles in their
  standard Linux locations.
- Prefer the distribution ffmpeg/ffprobe pair on Linux, avoiding crashes seen
  when the generic static build opens HTTPS artwork on some systems.
- Prefer a site's touch icon when its advertised social image is only a generic
  favicon, recovering stations with a broken root favicon URL.
- Prioritise artwork and the live visualiser in a compact Player instead of
  repeating the full queue, which remains available in section `7`.
- Centre-crop letterboxed embedded covers before text/Sixel rendering.
- Document source installation, updates, profile paths and terminal behaviour on
  Linux, including an Arch Linux quick start.
- Add x64 Linux install checks and platform-appropriate Node.js installer errors.

## 0.1.1-beta.3: Settings crash fix

- Fix the React hook-order crash when opening Download pacing or running a
  library conversion. Keyboard hooks now run consistently across settings pages.
- Add regression tests for pacing edits, reopening settings and an empty-library
  conversion. Download speeds and pacing defaults are unchanged.

## 0.1.1-beta.2: Temporary command-line options

- Keep command-line download options temporary for the current launch, including
  output directory, cookies and format. Startup and unrelated Settings changes
  no longer save them. Streaming reads the effective launch settings too.
- Clarify the help text. Older saved values aren't reset automatically because
  they cannot be distinguished from deliberately saved preferences.

- Credit funstuie-bit as a package contributor while retaining the upstream author
  and original MIT notice.
- New source/package installs provide only `jukeboxcli`, without the old
  `soundcli` command alias.

## 0.1.1-beta.1: First tagged prerelease (2026-09-11)

- Keep the player border and transport visible in short windows when the waveform loads.
- Show the player's measured duration in the current queue row. Other queue entries
  keep their stored durations; music files and library tags are unchanged.
- Publish a tagged Mac prerelease with installation instructions and a demo.
- Fresh-install and real-terminal checks for this build remain pending user testing.

## 0.1.0-dev.15: Native Terminal artwork and diagnostics

- Default Apple's Terminal to a simple disc/radio drawing instead of pixelated
  cover art, without loading cover images. `JUKEBOXCLI_ART=blocks` opts back into
  pixel artwork; `JUKEBOXCLI_ART=simple` selects drawings in any terminal.
- Preserve inline artwork in supported terminals and the artwork hide/show control.
- Give yt-dlp's version probe up to 15 seconds for cold startup and distinguish
  timeouts, process exit failures and launch errors in doctor output.
- Add a guide to the fork's additions and credited inspirations.

## 0.1.0-dev.14: Stream duration and history (2026-09-09)

- Keep known duration when resolver/mpv reports no usable duration; real positive
  engine duration still wins, live radio remains untimed.
- Record successfully started streams and radio alongside local plays; History and
  Home can replay them without downloading. Stable metadata is saved privately;
  transient media URLs and headers are excluded. Legacy history remains readable.
- Removing a stream from History does not stop playback or remove stations/queue entries.
- Source installer checks runnable mpv before installing JukeboxCli, installs missing
  mpv through Homebrew on Mac, and stops with visible errors if setup fails.
- Build-only `--check` does not install system dependencies. Node remains a prerequisite.
- No background Mac Homebrew installation on app launch; detect standard Homebrew
  mpv locations even when absent from the terminal PATH.

## 0.1.0-dev.13: First impressions and iTerm2 (2026-09-09)

- Listening-first welcome and H Home: online search, radio/URL, local music and
  optional downloads. Roomy Home adds recent local tracks, saved stations and
  current playback text; no automatic playback/download or sign-in.
- Original static ASCII-outline/Braille-grille jukebox, plain ASCII opt-in,
  responsive small-screen layout and regenerated branded SVG previews.
- Fresh profiles use JukeboxCli folders; existing legacy profiles/custom paths
  stay put, portable override wins, no automatic copying/merging/moving.
- iTerm2 inline PNG renderer, live capability/cell-size checks, 480px bounded
  payload, full-frame lifecycle, explicit text fallback/renderer label and doctor
  environment diagnostics.
- Idle player says Stopped; clearer empty Library actions, explicit muted colours
  in entry screens, no-sign-in-needed discovery label, branded request identifier.

## 0.1.0-dev.12: Mac controls and installation (2026-09-09)

- mpv-native media keys routed through JukeboxCli's full queue; descriptive system
  title, stop-as-pause, optional bridge fallback and JUKEBOXCLI_MEDIA_KEYS=0 opt-out.
  System identity remains mpv; no new native helper.
- Read-only --doctor; independent package installer with --prefix/--check,
  dirty-checkout-safe fast-forward update script, source-relocation/reinstall smoke.
- Managed system tools mode for Homebrew: no automatic binary fetch/update,
  with pinned source-formula packaging and Mac architecture CI.

## 0.1.0-dev.11: Search inside Now Playing (2026-09-08)

- S opens local/online search in both player layouts; l: local, s: songs,
  v: videos, default local. Existing signed-out discovery service reused.
- Results replace queue/lyrics without stopping playback; Enter plays, A/P
  append/next, d explicitly invokes existing download flow. No implicit downloads.
- Esc restores previous panel; queue cursor and lyrics browsing position retained.
  / still searches lyrics there, and searches music in the queue panel.
- Captured keyboard prevents typing from changing transport/navigation/queue;
  abort on edit/close/hide, stale-response guards, bounded/deduplicated results.

## 0.1.0-dev.10: Smarter matching and focused lyrics (2026-09-08)

- Explicit online-disabled prompt; no misleading plain-lyrics status before load.
- Exact lookup, then mastering-label/primary-artist fallback constrained by
  duration. Preserve live/remix/edit distinctions; ambiguous results need selection.
- / manual LRCLIB search, artist/title/album/duration choices, Enter selects,
  Esc cancels, R retries while respecting provider cooldown. Chosen lyrics are
  cached against the original song; mismatched/unknown timing is plain only.
- O explicitly opens lyrics.ovh Artist - Song lookup, plain/unverified and
  separately labelled. Never automatic, no new installation dependency.
- Centred cell-aware wrapping, active lyric plus two neighbouring lines each
  side, dimmed context; scroll/follow controls retained. Genuine enhanced-LRC
  timestamps underline the current word; no inferred word/letter animations.
- Search captures keyboard input without seeking, pausing or changing queue;
  stale/hidden requests are cancelled. Normalised selections survive offline.

## 0.1.0-dev.9: Optional lyrics (2026-09-08)

- Player l toggles queue/lyrics without seeking; ←/→ retain transport controls.
- Adjacent local LRC first, private bounded offline cache, then optional LRCLIB
  exact-metadata lookup. L explicitly enables network lookup; default is off.
- Timed lines follow mpv position/seeks, plain fallback and instrumental state.
  Radio uses conservative Artist - Song metadata and never claims synchronisation.
- Scroll/follow controls, cancellation on hide/track change, small-panel bounds,
  identified sequential provider requests, timeout and Retry-After handling.

## 0.1.0-dev.8: Station artwork refresh and removal (2026-09-08)

- Website rediscovery atomically refreshes metadata on existing exact-URL
  favourites, keeping names/URLs and previously saved artwork if none is supplied.
- Update artwork on matching queued/playing radio without reconnecting, renaming
  or adding occurrences. Enriched session metadata survives restart.
- g opens a website artwork-refresh prompt, prefilled when a website is known.
- x/d removal is visible in the footer; named confirmation, y accepts/esc cancels.
  Removal never deletes music or changes current playback/queue.

## 0.1.0-dev.7: Player layout polish (2026-09-08)

- Top-align the content-height player with the queue; remove centring and the
  expanding blank gap. Waveform is one/two rows rather than a five-row slab.
- Compact FILE/NET/LIVE TYPE column replaces repeated source prefixes in titles,
  retaining separate selected/playing markers and cell-correct Unicode widths.
- Sidebar, footer and top navigation hints use explicit palette colours; Calm
  also styles navigation chrome, without changing terminal preferences/background.
- No saved-station or playback metadata migration. Old station entries without
  artwork metadata still use the fallback; this is not an artwork repair release.

## 0.1.0-dev.6: Clearer player and radio presentation (2026-09-08)

- Capped, vertically centred player card beside full-height Playback queue;
  title/artist/broadcast text above bounded artwork, stacked small-window layout.
- Original radio/disc text fallback when artwork is missing; optional decorative
  animation, disabled by default and stopped for paused/hidden/loading views.
- LOCAL/ONLINE/LIVE queue labels, separate selected/playing/paused markers,
  saved-station guidance and duplicate-occurrence feedback without queue deduplication.
- Persisted Lavender/Calm player palette (T), reduced motion (V), and a scrollable
  Settings appearance page. Other app sections/terminal background are unchanged.
- Original terminal drawings and implementation; existing music, favourites and
  queue order are preserved.

## 0.1.0-dev.5: Website feed detection (2026-09-08)

- Paste station websites or PLS/M3U lists in o/R, then select a discovered feed.
  Static audio/player links only; cancellable 15-second/1-MiB/12-result limits.
  HLS stays a single feed. No script execution, recursive crawling or bulk probes.
- Known DKFM and requested Deeper Shades Radio Garden links; not general Radio
  Garden support. Website-advertised station artwork persists with favourites.
  DKFM's known stream still has no artwork.
- f/t naming starts empty: type replacement or enter to retain current name.
  Rename updates playing/queued radio without reconnecting; same-URL favourites
  retain names on rediscovery. Existing favourites/music are not migrated/deleted.

## 0.1.0-dev.4: Play URL and internet radio (2026-09-08)

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

## 0.1.0-dev.3: Player presentation (2026-09-07)

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

## 0.1.0-dev.2: Streaming and public discovery (2026-09-07)

- Visible Discover (8): signed-out YouTube Music search, five result types,
  album/artist/playlist browsing, pagination, stream/queue/download actions.
- Mixed local/remote queues, next-track preparation through mpv, cancellable URL
  resolution, one refresh on rejected media URLs and visible retry/skip errors.
- Stream thumbnails, explicit saved/streaming state and remote session v2 restore
  without network access until play. v1 sessions remain readable; music is unchanged.
- Corrected numbered navigation inside drill-downs and stale next-ready status.

## 0.1.0-dev.1: First JukeboxCli development build (2026-09-07)

- Visible Now Playing (6/m) and Queue (7), persistent shortcut hints and JukeboxCli branding.
- Append/play-next from track lists; select, reorder, remove and confirmed clear in the listening queue. No music deletion from queue actions.
- Queue, order, position, volume, shuffle and repeat restored paused; missing files dropped and moved files resolved through the library.
- Cover loads independently of waveform; editable queue replaces the passive up-next list. Dedicated Queue remains available in smaller windows.
- mpv loads wait for file-loaded; pause is applied before load. Pending loads are cancelled on stop/quit.
- Independent JUKEBOXCLI_HOME profiles and isolated test storage. Existing soundcli paths remain compatible.
- Dependency audit findings resolved in the lockfile. Distribution import check uses syntax parsing instead of matching UI strings.
