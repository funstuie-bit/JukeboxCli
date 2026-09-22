# Optional Mac fullscreen visualiser

This adds a separate projectM/MilkDrop window. The normal terminal visualiser,
queue and playback work without it. Nothing extra is downloaded on app launch
or when you press `F` without an installed pack.

## Install and use

Requires macOS 14.4 or newer and Apple's Command Line Tools. If those tools are
missing, run `xcode-select --install` and complete Apple's installer first.

```sh
jukeboxcli --install-visualizer
```

You can also use **Settings → Player appearance → Install Mac fullscreen pack**.
The confirmation page explains the download and build. Keep JukeboxCli open
until installation finishes. CMake is installed through Homebrew if missing;
mpv, your output device and music settings are not changed.

The pack contains projectM 4.1.7, 9,795 Cream of the Crop presets and the
upstream MilkDrop textures. Downloads total about 61 MB; the finished install
uses about 135 MB. Allow additional temporary disk space for the source build.
All downloads are version/commit pinned and SHA-256 checked before extraction.

Play something in JukeboxCli, then press uppercase `F` in Now Playing or select
**Fullscreen effects** under Player appearance. A shuffled preset is rendered
before the window is shown. The built-in M/headphones intro is never displayed.

- `N` or `Space`: next preset.
- `Esc` or `Q`: close the window, leaving music playing.
- Automatic preset changes: roughly every 30 seconds.
- Quit JukeboxCli: its visualiser and audio tap close too.

## Audio permission

macOS may ask to let **JukeboxCli Visualizer** record system audio. This permission
lets the companion read samples from JukeboxCli's existing mpv process. It does
not record files, upload audio, capture the microphone or mix in other apps.
No virtual audio driver is installed and playback remains with the same mpv.

If permission is denied, allow it under **System Settings → Privacy & Security →
Screen & System Audio Recording** (the wording varies by macOS version), then
close and reopen effects. A rebuild may require granting permission again.

If there's no reaction to audio, make sure a track is actually playing, check
that permission and reopen the window. If playback had to restart mpv after an
error, reopen effects so it can attach to the replacement player.

## Storage, repair and removal

The companion and assets live under the app's data directory at
`visualizer/mac/current`. A new Mac profile normally uses
`~/Library/Application Support/JukeboxCli/visualizer/mac/current`.
An existing profile may use the older `soundcli` data directory; an isolated
`JUKEBOXCLI_HOME` profile uses its own `data/visualizer/mac/current`.

Run the install command again to repair the pack. An existing working install
is replaced only after the new build passes its startup check. Failed builds
do not remove it. The optional pack is independent of Homebrew's JukeboxCli
Cellar directory, so upgrading the main app does not remove the presets.

To remove it, close effects and move **only that profile's `visualizer/mac`
folder** to the Trash. Music, playlists and normal playback are untouched.
CMake stays installed as a Homebrew build tool.

## Implementation and licences

The companion source is in `native/macos-visualizer`. It is built locally as an
ad-hoc-signed app, dynamically linked to libprojectM. It uses a Cocoa OpenGL 4.1
window and a private CoreAudio process tap. A bounded stereo ring buffer keeps
allocation and graphics work out of the audio callback. Rendering is capped at
60 fps using logical display size rather than a full Retina-resolution target.
Some community presets are heavier than others; press `N` to skip one.

The helper watches its parent pipe and mpv's PID. Parent death closes the pipe
even if the app crashes while the macOS permission dialog is open. The helper
owns no media stream. Linux retains its existing PulseAudio projectM frontend.

Upstream sources and notices:

- [projectM 4.1.7](https://github.com/projectM-visualizer/projectm/tree/v4.1.7):
  LGPL-2.1-or-later renderer, kept as a replaceable shared library in the app's
  `Contents/Frameworks` directory. COPYING and LICENSE.txt are retained.
- [Cream of the Crop](https://github.com/projectM-visualizer/presets-cream-of-the-crop):
  preset collection by many authors, with its original LICENSE.md retained.
  Individual preset rights are not relabelled as JukeboxCli's MIT licence.
- [MilkDrop texture pack](https://github.com/projectM-visualizer/presets-milkdrop-texture-pack):
  original texture collection and README retained.

The installed `manifest.json` records exact commits and hashes, including
projectM's evaluator submodule. No third-party preset or texture collection is
vendored into the main JukeboxCli package.

For developers, `--check` on the companion verifies loading without opening a
window. `--smoke <presets-dir> <textures-dir>` renders six shuffled presets in a
hidden window, with no audio capture or permission request. Normal unit tests
exercise opt-in gating, integrity checking and process lifecycle. Permission
prompts and live audio reaction still need acceptance testing in a Mac session.
