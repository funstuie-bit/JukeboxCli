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

## Active prototype — full-screen visualiser

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

The selected presentation is an optional Linux GPU window that enters real
fullscreen. The existing compact visualiser stays in the terminal unchanged;
there is no terminal-framebuffer version of this new mode. Closing the graphics
window returns to the unchanged JukeboxCli screen and must not alter playback,
the queue, position or the saved compact visualiser style.

The first [projectM](https://github.com/projectM-visualizer/projectm) integration
spike now opens its standalone PulseAudio frontend from Now Playing or Settings.
On the Arch/Hyprland test host it entered real 5120×2160 fullscreen, rendered
MilkDrop presets and captured the selected headphone output monitor without
changing the default microphone. Closing the window returned to the terminal,
and quitting JukeboxCLI cleans up the companion process.

projectM is an open-source, MilkDrop-compatible OpenGL renderer whose core
accepts PCM and performs its own FFT and beat detection. The prototype currently
captures the active system output, so unrelated audio can affect the picture.
If that proves distracting, adds unacceptable latency or cannot follow
JukeboxCLI reliably, feed bounded decoded PCM from the existing mpv process into
a small projectM frontend instead. Do not open a second media stream.

The dependency remains optional: ordinary startup, playback and the terminal
visualiser work when the fullscreen engine is absent. Remaining checks cover
track/radio changes, pause, unrelated system audio, CPU/GPU use and frame pacing.
Presets must be original or compatibly licensed. macOS support follows only
after its capture path and performance are measured.

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
