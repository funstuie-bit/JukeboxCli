# JukeboxCli architecture

Mac-first terminal music player, evolving the maintainer's soundcli fork. Keep Ink/React,
TypeScript, yt-dlp and mpv initially. Prototype graphics/mouse capability before
choosing any larger UI replacement.

Playback owns the listening queue, order, shuffle/repeat and current position.
DownloadQueue owns acquisition jobs; removing a listening-queue entry never
deletes music. Library IDs remain stable; duplicate queue entries are separate
positions. UI calls explicit playback actions rather than editing lists.

Versioned sessions resolve saved IDs through the library to recover moved paths.
Save atomically, coalesce progress writes, flush on shutdown and restore paused.
Existing soundcli paths stay compatible; JUKEBOXCLI_HOME selects an independent
profile. Do not run both apps against a shared profile concurrently.

`PlayableTrack` is a local Library Track or `StreamTrack` (kind=stream, stable
page URL, no filePath). Session v2 saves stream metadata through an allowlist;
v1 remains readable. Remote restore is lazy and paused, so offline launch never
waits for extraction. Local IDs still resolve through Library; streamed history
is not yet persisted. No signed media URL or extractor headers enter session JSON.

`sources/music.ts` adapts MIT-licensed YouTube.js 18 to plain search/browse pages.
Signed-out search supports five types; albums/playlists/artists drill down and
continuations normalise their different shelf shape. The UI uses request tokens
to ignore stale results; each provider fetch has a 20-second timeout. Leaving a
view cancels its result publication, not the already-issued remote request.
Music API authentication remains separate from yt-dlp cookies; account features
are future work. No ytkew source is imported.

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
defer rebuffering a changed next entry while paused. No universal gapless promise.

Acceptance scripts: smoke-listening.ts (local restore/transport) and
smoke-streaming.ts (loopback HTTP prefetch, headers, natural stream→stream→local
sequence, queue edits, prepared skip). Both generate silent fixtures in isolated
profiles. App tests cover Discover navigation, browsing, queueing and remote
paused restore; service and real-player probes supplement the fixture tests.

See ../FEATURES.md for status; the shared vault holds roadmap and session history.

## Player rendering (dev.3)

`playerLayout` splits at 86 content columns/16 body rows; smaller views stack.
Queue formatting measures terminal cells, not JS string length. Explicit player
colours avoid inheriting low-contrast terminal defaults. Art and waveform load
independently; visual failures never block playback.

Before Ink takes stdin, `probeGraphics` requests Kitty direct-image support and
CSI 16t cell dimensions (700ms timeout). Both must respond. Redirected I/O,
tmux/screen, missing replies or JUKEBOXCLI_ART=blocks select half-blocks. Early
keystrokes survive the probe; TERM_PROGRAM never enables graphics by itself.

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
actual embedded art and fake playback; b/?/q test visibility. `--auto` cycles help
and returns then exits. JUKEBOXCLI_VISUAL_REPORT optionally records placement
diagnostics. Run from the repo (or set TSX_TSCONFIG_PATH). Tests cover chunking,
probe/cleanup/stacked registrations, responsive layouts, Unicode queue columns
and App input/persistence. Ghostty native protocol/lifecycle was exercised;
OS screenshot capture was denied, so final visual acceptance remains open.
