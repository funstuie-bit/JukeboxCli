# Roadmap

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
- Persistent preview pane remains deferred until navigation acceptance.


## Implemented in source preview — 1.6.0-dev.3

- General YouTube Videos search alongside the existing YouTube Music catalogue.
- Discover Y / clickable source selectors, paginated video results with available
  channel/duration/live/date/view metadata and existing audio/video actions.
- Cancelled searches cannot replace results from a newly selected catalogue.

A persistent preview pane and full TubeTUI-style table remain future UI work.
This change adds the requested search catalogue, not full browsing parity.


## Implemented in source preview — 1.6.0-dev.2 (15 October 2026)

- [x] Explicit Play audio / Play video actions in Discover; audio stays the default.
- [x] Separate video window using the existing mpv process, with CLI transport controls.
- [x] Discover action menu via right click or keyboard: play audio/video, play next, queue, download and details.
- [x] Switch the current item between audio and video, retaining position, pause and volume where the source supports seeking. Live streams reconnect at the live edge.
- [x] Closing the video window stops the current item and leaves JukeboxCli open. Subsequent queue entries default to audio.
- [x] Test stream resolution, switching races, window closure and owned-process cleanup; install the preview and push both remotes.

Inspired by TubeTUI interaction patterns; independently implemented. See [controls and acceptance limits](video-playback.md). Physical macOS acceptance and wider online-source coverage remain pending. Stable release remains 1.5.0 until release acceptance.

## Implemented in source preview — 1.6.0-dev.1

- Linux ZIP/folder preset imports with preview and explicit installation.
- Optional MilkDrop Original and En D downloads alongside Cream of the Crop.
- Linux mpv-only fullscreen capture with explicit system-output alternative.
- Clickable player transport, timeline seeking and volume controls.
- Local per-minute memory trends in session diagnostics.

See [preview guide](visualiser-and-diagnostics.md). Release publication and wider
hardware/multi-hour acceptance remain pending.

## Current release — 1.5.0

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
station artwork on Mac and Linux. In Radio / URL (`9`), press `S` to browse.

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
accepts PCM and performs its own FFT and beat detection. Stable 1.5.0 captures the system output; source preview 1.6.0-dev.1
uses a per-mpv PulseAudio monitor, with system capture explicitly selectable.
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

Source preview adds user archive imports and two more pack choices. Still open:
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
timing records during long sessions. Linux shares the 1.5.0 source with macOS;
long-duration memory acceptance remains open (see [Linux handover](linux-development-handover.md)).
