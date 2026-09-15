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

Build a separate, Linux-first animated visual-effects mode in the spirit of
Winamp AVS/MilkDrop. The target is evolving psychedelic imagery, waveform
geometry, feedback trails, colour fields and preset transitions—not a larger
arrangement of the compact player's bars or peaks.

This requires a new effects input and renderer. Feed it bounded PCM samples and
a higher-resolution FFT from the existing playback process, then derive beat
energy, waveform shapes and spectrum data without opening a second media stream.
The effects pipeline can combine Cartesian/polar transforms, persistence between
frames, palettes and parameterised presets. The current eight-band meter remains
independent and is not the prototype's rendering foundation.

Start with a feasibility spike comparing two presentations:

- A terminal-native true-colour or graphics-protocol framebuffer, which stays
  inside JukeboxCli but has terminal resolution and refresh-rate limits.
- A Linux GPU window that can enter real fullscreen, which is closer to the
  original experience but adds a graphics/window-system dependency and leaves
  the terminal while active.

Both must keep music/radio and the queue untouched, return cleanly to the prior
screen on Escape, stop rendering when hidden, restore the terminal on failure,
and measure CPU, frame pacing and audio latency. Presets must be original or
compatibly licensed. Choose the presentation after seeing both spikes; macOS
support follows only after its capture path and performance are measured.

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
