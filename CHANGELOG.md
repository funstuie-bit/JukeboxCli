# Changelog

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
