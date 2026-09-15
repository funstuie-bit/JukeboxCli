# Roadmap

## Current release — 1.0.4

The current production line includes local and online playback, an editable
mixed queue, Radio Browser, lyrics, terminal artwork, six compact live
visualiser styles, app-managed yt-dlp channels, Linux browser-keyring support,
macOS media controls, source installers and a pinned Homebrew formula.

Version 1.0.4 makes a normal Arch/Linux source install fall back to the user's
`$HOME/.local` prefix when npm points at a system-owned directory. It also owns
bracketed paste for the full terminal session, preventing a large paste from
quitting the app and leaving commands for the shell to execute.

## Next — hands-on coverage

- Check iTerm2 artwork repainting, physical media keys and Control Centre on
  macOS, plus a clean Intel Mac installation.
- Exercise more Linux terminals, browsers and keyrings. KWallet continues
  through yt-dlp's platform handling unless testing shows a specific gap.
- Track changes in YouTube extraction and the community Radio Browser service.

## Planned prototype — full-screen visualiser

Build a separate, Linux-first visualiser view while music or radio continues to
play. It should use the existing audio-analysis connection, occupy the terminal
instead of sharing the Now Playing layout, and return to the previous screen on
Escape without changing the queue, playback position or saved compact style.

The first bounded prototype should turn the existing eight frequency bands into
a terminal-native display with responsive bars, peaks, mirroring, trails and
colour movement. It must remain readable at different terminal sizes, stop work
when hidden or paused, respect reduced-motion and `NO_COLOR`, and measure redraw
cost and CPU use during local music and live radio.

A more fluid Winamp/MilkDrop-like mode is a separate second step. It would need
more FFT bins or bounded PCM samples for oscilloscope and geometric effects.
Prototype that richer input only if the eight-band version cannot produce a
convincing result; keep playback isolated and avoid a second media download.
macOS support follows only after the capture path and performance pass there.

## Later

- Try colours taken from cover artwork.
- Consider optional mouse controls, a Vim key preset and automatic pagination
  while playing very large online collections.
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
