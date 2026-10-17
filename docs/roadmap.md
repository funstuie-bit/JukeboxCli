# Roadmap

## Implemented in source preview — 1.8.1-dev.3

- [x] Sharp native Home thumbnails alongside the featured cover; keep fallbacks.
- [x] Independent image lifetimes and foreground priority for overlapping views.
- [x] Adaptive Sixel colours and painting after Ink flushes loading frames.
- [x] Real Foot Home acceptance with long titles and hide/restore captures.

## Implemented in source preview — 1.8.1-dev.2

- [x] Prevent long Home titles from shrinking artwork and wrapping it over nearby UI.
- [x] Check thumbnail row geometry as well as simultaneous image visibility.

## Implemented in source preview — 1.8.1-dev.1

- [x] Keep Home's recent/station artwork visible together with the native featured cover.
- [x] Patch the development-only source-map-js dependency identified in the Linux audit.
- Stable/Homebrew remain 1.8.0; this preview is available from source on Mac/Linux.

## Current release — 1.8.0

- [x] First-run/Home setup choices: mouse, colours, motion and direct extras links.
- [x] Dismissible Home checklist without automatic preference changes/downloads.
- [x] Recent artwork/station tiles, roomy cover header and opt-in artwork accents.
- [x] Reduced-motion-aware decorative cabinet lights; retain compact layouts.
- [x] Mac projectM status, progress and explicit install failure/retry feedback.
- [ ] Continue fresh-Mac projectM install/build and remote-display acceptance.

## Shipped in 1.7.0

- [x] Home dashboard with quick-launch cards, listening context, recents and stations.
- [x] Compact row/column budgets, stable selection and mouse/keyboard actions.
- [x] Explicit one-item Retry without cookies, with no saved-setting changes.
- [x] Separate anonymous/configured caches and non-persisted retry consent.
- [x] Isolated, geometry-correct Home documentation preview and regression coverage.

## Shipped in 1.6.2

- [x] Retain HLS audio selections with unknown codec and repair missing external audio.
- [x] Try an HLS soundtrack on the existing single YouTube playback retry.
- [x] Broaden Firefox detection, provide browser/manual fallbacks and explain access errors.
- [x] Clear stream caches when cookie selection changes and distinguish cookie-read failures.
- [x] Explain opt-in click controls and verify actual decoded audio in the player smoke check.

## Shipped in 1.6.1

- [x] Play separate YouTube picture/sound streams in the existing mpv process.
- [x] Preserve useful, safe video failure reasons instead of a blanket try-audio message.
- [x] Add regression coverage for expiry, audio reversion and private URL handling.
- Real Mac/Linux acceptance command: `npx tsx scripts/smoke-video.ts`, with an
  optional public YouTube URL. Available from source and the Mac Homebrew tap.

## Shipped in 1.6.0

- [x] Dedicated YouTube Videos, audio/video item menus and compact landscape previews.
- [x] Persistent search history, shared context menus and wider click navigation.
- [x] Reordered, renumbered and brighter sidebar, with Settings last.
- [x] Linux preset imports/extra packs and mpv-only fullscreen capture.
- [x] Production runtime timing-retention fix and bounded memory diagnostics.
- [ ] Continue multi-hour memory/GPU, broader terminal and physical Mac acceptance.
- Fuller results tables, drag seeking and timed live recording remain later work.

The preview entries below record development history for this stable release;
intermediate icon/numbering choices were superseded by the final implementation.

## Implemented in source preview — 1.6.0-dev.17

- [x] Compact video preview card sized to its content, with two-line titles.
- [x] Full landscape thumbnail framing in block/Sixel and native image modes.

## Implemented in source preview — 1.6.0-dev.16

- [x] Persistent independent search history and bounded cached results after restart.
- [x] Recent-search menus with repeat/clear actions and keyboard/mouse access.
- [x] Responsive YouTube thumbnail/details preview pane with selection following.
- [ ] Continue multi-hour memory/GPU and physical Mac acceptance after release.
- Fuller video tables, drag seeking and timed live recording remain later work.

## Implemented in source preview — 1.6.0-dev.15

- [x] Restore the user-preferred clapperboard after physical terminal feedback on the red icon.

## Implemented in source preview — 1.6.0-dev.14

- [x] Red play icon for the YouTube Videos sidebar entry.

## Implemented in source preview — 1.6.0-dev.13

- [x] Clearer coloured sidebar icons, brighter text and fixed icon/marker columns.
- [x] Shared sidebar width budgeting and aligned ASCII fallback.

## Implemented in source preview — 1.6.0-dev.12

- [x] Renumber sections in sidebar order: 5 Player, 6 Queue, 7 Music, 8 Radio, 9 Settings.
- [x] Shared navigation mapping for labels and key handling; current help/guides updated.

## Implemented in source preview — 1.6.0-dev.11

- [x] Settings at the end of the sidebar; icons across all sections, with plain-terminal fallbacks.
- [x] Stable keyboard shortcuts independent of the visual menu order.

## Implemented in source preview — 1.6.0-dev.10

- [x] Audio/video item choices beyond discovery: Home, saved lists, Queue, radio/URL and player search.
- [x] Original YouTube video playback for downloaded audio, preserving local files and queue occurrences.
- [x] Audio-first left-click; explicit video remains available through the menu and YouTube Enter.
- Unknown URLs are not probed merely to build menus; unsupported sources keep Play.

## Implemented in source preview — 1.6.0-dev.9

- [x] Left-click activates Home, saved-list, discovery, radio and queue entries.
- [x] Context actions on Home recent items/stations, shared song/playlist lists,
  radio, player search and Queue; nested row actions take priority over the player.
- [x] Clickable Settings and nested option menus. Keyboard navigation retained.
- Drag operations and full pointer coverage of specialist editors remain future work.

## Implemented in source preview — 1.6.0-dev.8

- Block unbounded live-broadcast downloads with explicit play-only feedback.
- Owned download-group cleanup on cancellation, pause and host exit; resistant
  helper and abrupt-host-exit regression coverage. Timed live recording remains
  a separate future feature.

## Implemented in source preview — 1.6.0-dev.7

- Compact anchored context-menu overlays in Now Playing and both Discover sections.
- Player/results remain visible, without reflow or losing queue selection;
  click-away dismissal, edge clamping and keyboard access.

## Implemented in source preview — 1.6.0-dev.6

- Fix the search focus trap: sidebar clicks work while typing in click mode.
- Visible search cancel target and bounded text field; result history remains
  session-only in this preview; dev.16 adds cross-restart search history.

## Implemented in source preview — 1.6.0-dev.5

- Now Playing right-click / c actions for transport, volume, audio/video and
  fullscreen effects, with isolated menu input and keyboard fallback.
- Search result menus retained in both Music Discover and YouTube Videos.

## Implemented in source preview — 1.6.0-dev.4

- Separate YouTube Videos sidebar section (Y), first-visit search field and
  visible query; Enter plays video and a plays audio only.
- Independent music/video browsing snapshots while moving between sections.
- Video title/channel/duration columns and small music/video/live/queued icons,
  with a compact list on narrow terminals and plain-symbol fallbacks.
- Persistent preview pane was deferred here; implemented in dev.16.


## Implemented in source preview — 1.6.0-dev.3

- General YouTube Videos search alongside the existing YouTube Music catalogue.
- Discover Y / clickable source selectors, paginated video results with available
  channel/duration/live/date/view metadata and existing audio/video actions.
- Cancelled searches cannot replace results from a newly selected catalogue.

The persistent preview pane ships in dev.16; a fuller TubeTUI-style table remains future work.
This change adds the requested search catalogue, not full browsing parity.


## Implemented in source preview — 1.6.0-dev.2 (15 October 2026)

- [x] Explicit Play audio / Play video actions in Discover; audio stays the default.
- [x] Separate video window using the existing mpv process, with CLI transport controls.
- [x] Discover action menu via right click or keyboard: play audio/video, play next, queue, download and details.
- [x] Switch the current item between audio and video, retaining position, pause and volume where the source supports seeking. Live streams reconnect at the live edge.
- [x] Closing the video window stops the current item and leaves JukeboxCli open. Subsequent queue entries default to audio.
- [x] Test stream resolution, switching races, window closure and owned-process cleanup; install the preview and push both remotes.

Inspired by TubeTUI interaction patterns; independently implemented. See [controls and acceptance limits](video-playback.md). These changes are included in stable 1.6.0; physical Mac acceptance and wider online-source coverage remain ongoing.

## Implemented in source preview — 1.6.0-dev.1

- Linux ZIP/folder preset imports with preview and explicit installation.
- Optional MilkDrop Original and En D downloads alongside Cream of the Crop.
- Linux mpv-only fullscreen capture with explicit system-output alternative.
- Clickable player transport, timeline seeking and volume controls.
- Local per-minute memory trends in session diagnostics.

See [setup guide](visualiser-and-diagnostics.md). Included in stable 1.6.0; wider
hardware/multi-hour acceptance remains ongoing.

## Shipped in 1.5.0

- Browsing artwork previews for local songs, collections and downloaded playlists.
- Optional Clean player layout and editable Up Next view; 7 retains the full queue.
- Draft theme editor with explicit save/cancel, background/border/contrast/accent.
- Custom transport/player/queue shortcuts with conflict checks and dynamic help.
- Height-aware settings menus that keep selection after toggles and editor visits.
- Opt-in queue continuation for explicitly started online collections, bounded
  and cancelled on stop/context replacement. No playback on import or downloads.

Independent implementations inspired by Orpheus; no source/assets copied.
See [controls and limitations](player-polish.md). Included in Homebrew.

## Also included from 1.4.0

- Session diagnostics viewer and explicit sanitised report export.
- JSON/M3U playlist import preview and export; missing files skipped, no automatic
  downloads or playback, music-relative local references across machines.
- Library genre browsing/search/details; read-only genre-tag scan on request.
- Optional artwork colours, j/k navigation and mouse row selection.
- Optional near-end Discover pagination (not automatic playback-queue extension).

See [controls and limitations](library-and-diagnostics.md). These changes are
included in Homebrew. Direct-display/physical hardware checks below
still need hands-on acceptance; automated checks cannot establish those results.

## Previous releases

Version 1.3.1 adds five Studay FM radio presets, website feed discovery and
station artwork on Mac and Linux. In Radio / URL (`8`), press `S` to browse.

Version 1.3.0 adds artist/album browsing, multi-track queue actions and responsive
text details in the library. Version 1.4.0 adds genre metadata, portable playlist
import/export and a session-log viewer.

Version 1.2.0 adds Mac fullscreen MilkDrop, Linux preset packs and logo-free
startup on both platforms. It retains the 1.1.1 fix for orphaned mpv playback.

The current production line includes local and online playback, an editable
mixed queue, Radio Browser, lyrics, terminal artwork, six compact live
visualiser styles, app-managed yt-dlp channels, Linux browser-keyring support,
macOS media controls, source installers, a pinned Homebrew formula and optional
Mac and Linux fullscreen MilkDrop effects.

Version 1.1.0 adds a separate projectM graphics window on Linux. It captures the
active PipeWire/PulseAudio output monitor, starts a shuffled community preset in
real fullscreen and leaves playback and the compact terminal visualiser running.
The dependency is optional.

## Next — hands-on coverage

- Library improvements inspired by mpv-music: songs/artist/album
  browsing, multi-track queue actions and responsive text details. Test `B`,
  Enter/Escape, `x`/`X`, `A`/`P` and `i` on your own collections and terminals.
  Genre metadata, portable playlist import/export and diagnostics are now in the
  1.4 release; exercise their controls with your own collection.

- Version 1.2.0 adds an opt-in Mac projectM 4 companion with Cream of the Crop
  and MilkDrop textures. Build, preset rendering and process-lifetime checks
  pass; a user test over screen sharing reports it working, with some visual
  artefacts attributed to the remote connection. Direct-display and longer
  playback checks remain useful. See
  [the Mac visualiser guide](mac-visualizer.md).

- Check iTerm2 artwork repainting, physical media keys and Control Centre on
  macOS, plus a clean Intel Mac installation.
- Exercise more Linux terminals, browsers and keyrings. KWallet continues
  through yt-dlp's platform handling unless testing shows a specific gap.
- Track changes in YouTube extraction and the community Radio Browser service.

## Shipped in 1.1.0 — full-screen visualiser

The separate Linux visual-effects mode provides evolving psychedelic imagery,
waveform geometry, feedback trails, colour fields and preset transitions in the
spirit of Winamp AVS/MilkDrop. It is independent of the compact player's bars
and peaks.

The [projectM](https://github.com/projectM-visualizer/projectm) integration opens
its standalone PulseAudio frontend from Now Playing or Settings.
On the Arch/Hyprland test host it entered real 5120×2160 fullscreen, rendered
MilkDrop presets and captured the selected headphone output monitor without
changing the default microphone. Closing the window returned to the terminal,
and quitting JukeboxCLI cleaned up the companion process. The launcher skips
projectM's branded introduction and selects a shuffled community preset.
The earlier shortcut-based skip still showed the logo briefly. Version 1.2.0
replaces it with a private frontend that selects a valid preset before the first
render. A native readiness handshake replaces the fixed 1.8-second shortcut.
Arch installation builds the companion against system libprojectM 3.1.12/Qt 5;
source and licences are retained. Longer memory-soak testing remains open.

projectM is an open-source, MilkDrop-compatible OpenGL renderer whose core
accepts PCM and performs its own FFT and beat detection. Version 1.6.0 uses a per-mpv PulseAudio monitor, with system capture explicitly selectable.
No second media stream or audio rerouting is introduced.

The dependency remains optional: ordinary startup, playback and the terminal
visualiser work when the fullscreen engine is absent. Longer hands-on checks
still cover track/radio changes, pause, unrelated system audio, CPU/GPU use and
frame pacing. The Mac companion uses a process-specific
CoreAudio tap instead; see the Mac guide above.

## Optional Linux packs — shipped in 1.2.0

Implemented: Classic / Cream of the Crop / Combined selection, confirmed optional
downloads with textures, pinned archive verification, flattened collision-safe
preset paths, retained notices and missing-pack fallback. Arch installer handles
core native dependencies and basic projectM presets; optional browser support and
extra-pack flags keep larger downloads explicit. See [pack guide](linux-preset-packs.md).

Version 1.6.0 adds user archive imports and two more pack choices. Still open:
newer native renderers, broader collections and long-session memory/GPU soak.
No full-collection shader compatibility claim.

## Later

- Evaluate drag seeking and further mouse coverage after the new click controls.
- Exercise 1.5's queue continuation with long online playlists; 1.4's optional
  pagination only loads visible Discover results.
- Consider other platforms once installation and playback tests exist.

## Not planned

- Separate YouTube Music sign-in, account likes or personalised-radio sync.
  Existing browser cookies remain the playback/download authentication route.
- DRM bypass, arbitrary website script execution or universal station discovery.
- Automatic downloads just from playing or queueing a track.
- Rewriting the interface framework just to look like another player.

There is no universal gapless guarantee, DRM support, general Radio Garden
browsing or automatic signed-in Music API access. See
[feature status](../FEATURES.md) for the current contract and known limits.

Packaged startup uses React production mode to avoid retaining development render
timing records during long sessions. Linux and macOS share the same release;
long-duration memory acceptance remains open (see [Linux handover](linux-development-handover.md)).
