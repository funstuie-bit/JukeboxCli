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

Future remote entries must distinguish saved files from stream locations.
Music API authentication is separate from yt-dlp cookies. Provider selection and
stream URL expiry handling await the streaming milestone; do not pass remote
URLs off as local Track.filePath values. Check licensing before upstream reuse.

See ../FEATURES.md for status; the shared vault holds roadmap and session history.
