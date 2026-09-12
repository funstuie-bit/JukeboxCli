# JukeboxCli architecture

Mac-first terminal music player built on the soundcli library/download foundations,
using Ink/React, TypeScript, yt-dlp and mpv.

`Playback` owns the listening queue, order, shuffle/repeat and current position.
`DownloadQueue` handles downloads. They are separate: removing a track from the
listening queue never deletes music. Library IDs stay stable; adding the same
track twice creates two queue positions. The UI calls playback methods rather
than editing the lists itself.

On macOS, mpv multimedia bindings send namespaced client-message events into
Playback, so native next/previous honours this queue rather than mpv's preload
list. Optional binding failure preserves ordinary playback; env opt-out is
JUKEBOXCLI_MEDIA_KEYS=0. mpv owns OS integration and identity, not a new helper.
See [Mac controls/install notes](mac-controls-and-install.md) for platform limits.

Source installs stage and bundle the locked production npm tree into an independent
archive. Homebrew instead builds a pinned Git revision into libexec and declares
system tool dependencies; JUKEBOXCLI_SYSTEM_TOOLS=1 disables app-managed binary fetches
and auto-updates. Doctor is read-only and bypasses app/bootstrap work.

Versioned sessions resolve saved IDs through the library to recover moved paths.
Save atomically, coalesce progress writes, flush on shutdown and restore paused.
Existing soundcli paths stay compatible; JUKEBOXCLI_HOME selects an independent
profile. Do not run both apps against a shared profile concurrently.
Profile selection uses branded JukeboxCli paths for truly fresh installations, preserving
legacy profiles when detected (branded config/data wins if both exist). Selection
does no writes or migration; a saved custom libraryDir still wins over defaults.

`PlayableTrack` is a local Library Track or `StreamTrack` (kind=stream, stable
page URL, no filePath). Session v2 saves stream metadata through an allowlist;
v1 remains readable. Remote restore is lazy and paused, so offline launch never
waits for extraction. Local IDs still resolve through Library. History persists successfully started
streams/radio as allowlisted stable metadata alongside local references, with a
500-entry bound. Home and History can replay streams without downloading. Queueing
alone does not record a play, and earlier unrecorded plays cannot be recovered.
Removing stream history never deletes music, saved stations or queue entries.
No extracted signed media URL or extractor headers enter session or history JSON.
Direct URLs you supply are saved, including query tokens. That makes these
profile files private; see [online listening](listening-online.md).

`sources/music.ts` adapts MIT-licensed YouTube.js 18 to plain search/browse pages.
Signed-out search supports five types; albums/playlists/artists drill down and
continuations normalise their different shelf shape. The UI uses request tokens
to ignore stale results; each provider fetch has a 20-second timeout. Leaving a
view cancels its result publication. Player search additionally scopes AbortSignal
through AsyncLocalStorage to abort its HTTP requests and continuations independently;
shared client bootstrap retains its timeout and does not inherit a caller's abort.
Music API authentication is distinct from yt-dlp cookies. There is no separate Music sign-in;
browser-cookie playback/downloads remain available.
Cookies don't add account playlists or likes. Those aren't implemented.
No ytkew source is imported.

`player/resolve.ts` runs yt-dlp metadata-only extraction with the configured cookie
source, abort signals and a 45-second timeout. Direct media URLs and whitelisted
HTTP headers remain in a bounded memory cache (100 entries, at most five minutes,
shortened for signed expiry). Foreground rejection refreshes once; prefetch errors
defer to foreground retry. Errors shown to users omit extractor output/URLs.

Playback prepares exactly one next entry in actual repeat/shuffle order. Queue
edits invalidate its token and mpv playlist entry. mpv 0.38+ accepts per-file
headers and direct URLs; playlist entry IDs associate natural advance with a
queue occurrence, preventing the EOF handler from loading it twice. Local and
remote entries use the same pipeline. Stop/new selection abort old resolution.
mpv prefetch is best effort, with forward/back demuxer limits of 32/4 MiB; it may
defer rebuffering a changed next entry while paused. Gaps can still happen.

Fixture verification scripts: smoke-listening.ts (local restore/transport) and
smoke-streaming.ts (loopback HTTP prefetch, headers, natural stream→stream→local
sequence, queue edits, prepared skip). Both generate silent fixtures in isolated
profiles. App tests cover Discover navigation, browsing, queueing and remote
paused restore; service and real-player probes supplement the fixture tests.

See [feature status](../FEATURES.md) and the [roadmap](roadmap.md).

## Launch options and saved preferences

The entry point passes parsed flags to App without writing config. `ConfigSession`
keeps saved preferences separate from the effective config for this launch.
Downloads and the stream resolver use that effective config, including temporary
cookies and output location. The resolver reads it in memory, not from disk.

UI updates compare the next config with the current effective values and save
only changed fields onto the saved preferences. Onboarding, theme changes and
lyrics opt-in therefore cannot persist unrelated CLI overrides. Editing an
overridden field to a different value in Settings makes that edit permanent.
Writes are serialized. A fresh launch without flags loads only saved preferences.
Previously persisted CLI values cannot be distinguished from deliberate preferences;
the fix does not guess at or reset existing settings.

## Player rendering

`playerLayout` splits at 86 content columns/16 body rows; smaller views stack.
Queue formatting measures terminal cells, not JS string length. Explicit player
colours avoid inheriting low-contrast terminal defaults. Art and waveform load
independently; visual failures never block playback.

Without a native graphics renderer, Apple's Terminal defaults to a simple
disc/radio drawing. `JUKEBOXCLI_ART=blocks` overrides that default; `simple`
disables graphics probing and cover extraction in any terminal. Cover render
keys include the mode so stale image results cannot replace a simple drawing.

Before Ink takes stdin, `probeGraphics` requests Kitty direct-image support and
CSI 16t cell dimensions (700ms timeout). Both must respond. Redirected I/O,
tmux/screen, missing replies or JUKEBOXCLI_ART=blocks select half-blocks. Early
keystrokes survive the probe; TERM_PROGRAM never enables graphics by itself.
The probe additionally queries iTerm2 Capabilities/ReportCellSize when indicated.
Feature F advertises inline images; older iTerm2 needs its identity plus a live
cell-size response. Reply collection uses the same bounded probe window. Inline
mode emits OSC1337 File=inline=1 PNGs, at 480px RGB to bound base64 below 1 MiB.
Ink's full-frame text redraw erases inline images; repaint occurs afterward.
There is no post-frame rectangle erasure, which could destroy new text. Keep
incremental rendering disabled.

`Cover` reserves an Ink box and registers its geometry. `GraphicsPainter` chooses
the latest visible registration; an expanded player can hide an embedded player
without losing its registration. Coordinates sum Yoga ancestor offsets;
display:none ancestors suppress pixel art too. Ink 7's onRender callback precedes
stdout output, so painting is deferred with setImmediate. Cursor save/restore and
Kitty C=1 preserve Ink's cursor. Only this app's image ID is deleted.

PNG extraction is limited to 1024px/5MiB/8 seconds, cached for 12 source entries
per process. Transmission uses 4096-character base64 chunks and quiet replies.
A placement ID is reused for moves/resizes. Only width is sent, so the terminal
preserves source aspect; probed cell dimensions budget height. Restart after
changing font proportions if needed; window size changes are handled live.

`scripts/visual-player.tsx <audio>` is a real-terminal, read-only fixture with
actual embedded art and fake playback; b/?/q test visibility. Pass `--radio` instead
of an audio path for a network-free radio/mixed-queue fixture, T/V to change its
in-memory appearance. `--auto` cycles help
and returns then exits. JUKEBOXCLI_VISUAL_REPORT optionally records placement
diagnostics. Run from the repo (or set TSX_TSCONFIG_PATH). Tests cover chunking,
probe/cleanup/stacked registrations, responsive layouts, Unicode queue columns
and App input/persistence. Real-terminal checks remain necessary for protocol,
font and permission differences.

### Player presentation

`playerLayout` bounds the artwork area; the content-height split player card is
top-aligned next to the full-height queue with no expanding spacer. Metadata precedes artwork; radio
uses up to three metadata lines in taller windows. No waveform/pretend spectrum for
radio; local waveform is limited to one/two rows. Cover keeps real native/half-block images ahead of its optional fallback;
missing sources/extraction failures render original terminal text artwork.
`RadioFallback` owns a 700ms decorative timer only when enabled, visible, playing,
not loading and at least seven rows tall; cleanup stops it on hide/pause/unmount.

Config adds optional playerTheme (lavender/calm) and reducedMotion (default true),
normalised on load. Palettes are pure values, not mutable process-global theme state.
T/V in player and the Settings appearance picker persist via existing config saves.
Player/queue plus sidebar/footer/top navigation hints use the selected palette;
other section contents retain their shared palette. Settings menu is
windowed so appearance and existing actions remain reachable on short terminals.

Queue display uses two independent marker cells (selection, playing/paused), a
four-cell FILE/NET/LIVE source column and a saved-station reminder. A/P feedback detects matching IDs before append;
intentional repeats remain supported and existing queue/favourite data is untouched.
Tests cover layout bounds, artwork-to-fallback changes, timer cleanup, marker
independence, config round-trip/defaults, full-App appearance controls and repeats.
