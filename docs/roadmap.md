# Roadmap

## Current release — 1.1.0

The current production line includes local and online playback, an editable
mixed queue, Radio Browser, lyrics, terminal artwork, six compact live
visualiser styles, app-managed yt-dlp channels, Linux browser-keyring support,
macOS media controls, source installers, a pinned Homebrew formula and optional
Linux fullscreen MilkDrop effects.

Version 1.1.0 adds a separate projectM graphics window on Linux. It captures the
active PipeWire/PulseAudio output monitor, starts a shuffled community preset in
real fullscreen and leaves playback and the compact terminal visualiser running.
The dependency is optional.

## Next — hands-on coverage

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

projectM is an open-source, MilkDrop-compatible OpenGL renderer whose core
accepts PCM and performs its own FFT and beat detection. This version currently
captures the active system output, so unrelated audio can affect the picture.
If that proves distracting, adds unacceptable latency or cannot follow
JukeboxCLI reliably, feed bounded decoded PCM from the existing mpv process into
a small projectM frontend instead. Do not open a second media stream.

The dependency remains optional: ordinary startup, playback and the terminal
visualiser work when the fullscreen engine is absent. Longer hands-on checks
still cover track/radio changes, pause, unrelated system audio, CPU/GPU use and
frame pacing. macOS support follows only after its capture path and performance
are measured.

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
