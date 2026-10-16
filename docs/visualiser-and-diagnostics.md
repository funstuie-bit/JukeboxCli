# Preset imports, player mouse controls and memory diagnostics

These changes are included in stable **1.6.0** on Mac and Linux, including Homebrew. Pack management and process audio capture below are Linux features.
Mouse controls and memory logging also work on macOS.

## Optional preset downloads

Settings → Player appearance → MilkDrop packs offers Classic, Cream of the Crop,
MilkDrop Original and En D. Downloads require confirmation and are pinned to a
revision and SHA-256 checksum. Nothing downloads just by opening this screen.
Each extra download includes the shared MilkDrop textures and retains upstream
notices. Pack-specific textures take precedence. Classic stays part of the Arch
native dependency installation. Combined means Classic plus Cream of the Crop.

```sh
jukeboxcli --install-preset-pack milkdrop-original
jukeboxcli --install-preset-pack en-d
jukeboxcli --preset-pack cream-of-the-crop
```

Original contains 552 presets (~4 MB download with textures); En D contains 40
(~6 MB with textures). These are upstream collections, not a promise that every
shader renders on projectM 3. Close and reopen fullscreen after changing packs.

Sources: [MilkDrop Original](https://github.com/projectM-visualizer/presets-milkdrop-original)
revision `e03b83e3338d8f1ed6cbcf908c719f249ef24288`, archive SHA-256
`7d77502c03a10bb989e69b4bb01a8e65a1710f8cc23e3b5eff73f2b54d882630`;
[En D](https://github.com/projectM-visualizer/presets-en-d) revision
`fff71ea81223109f3558351667eef851f2781c96`, archive SHA-256
`fa91e0fa4acd1d9fb6c42c50f12360ceee761826e2282c86bca6df19b2a22e0b`.
Their authors' terms remain applicable; no preset assets are bundled with the app.

## Import a ZIP or folder

Choose **Import ZIP or folder…** and enter its full path (a leading `~` works).
The app stages a copy, then previews the name, preset/texture counts, expanded
size and sample filenames. Choose **Install and select**, or Back to discard.
Source files stay in place. Nothing is selected until installation succeeds.
Imported packs appear by name in the same picker and persist across restarts.

Only `.milk` presets, supported image textures and README/licence notices are
installed. Preset names are made unique; texture basenames stay intact. Duplicate
texture names are rejected because flattening them would change shader behaviour.
Links, special files, encrypted ZIPs and traversal paths are rejected. Limits:
25,000 entries, 16 MiB per file, 256 MiB expanded, 32 folder levels. Staging is
removed on cancellation or failure. Abrupt process death can leave a hidden
`.preview-*` folder; it is not an installed/selectable pack. Native projectM still
loads and interprets the selected presets; the preview does not certify shaders.
Imports live in the profile data directory under `projectM/imports/` with a manifest.

## Linux audio isolation

Fullscreen audio now defaults to **JukeboxCli only**. The native companion finds
the PulseAudio sink input belonging to the existing mpv PID, then uses
`pa_stream_set_monitor_stream` before connecting the recording stream. It follows
sink-input removal/recreation and output moves through PulseAudio subscriptions.
It does not reroute playback, create a second music stream or capture a microphone.
It waits for both a real preset and a connected audio monitor before reporting ready.

Pause/stop makes the captured audio silent. Missing or unsupported process capture
at startup reports an error; it never silently falls back to the system mix. If your mpv uses
an audio backend that is not exposed through PulseAudio/PipeWire-Pulse, choose
**Settings → Player appearance → Fullscreen audio: system output** explicitly.
If mpv itself crashes and restarts with a new PID, reopen fullscreen to bind to
the new process. System mode includes other applications' audio. Restart fullscreen after changing
this setting. Reinstalling the app rebuilds the updated private Qt frontend; you
can also run `jukeboxcli --install-linux-visualizer`.

The companion closes on normal app cleanup and watches for parent-process death.
The terminal spectrum remains independent. Full GPU/shader and multi-hour soak
acceptance remains a separate hardware check.

Maintainer acceptance: `python3 scripts/check-linux-capture.py` builds a small
probe using the exact native capture code, creates a temporary null sink, plays
two isolated mpv tones and checks that only the selected player's signal is
captured. It cleans up only its own processes and module. Requires Linux with
PulseAudio-compatible pactl, mpv and C++/libpulse development files.

## Mouse playback controls

Enable **Settings → Keyboard and mouse → Mouse: click**. Now Playing shows
clickable Prev / Play-Pause / Next buttons and volume −/+ controls (5% steps).
Click the progress line to seek to that fraction of a finite track. Live radio,
loading and unseekable streams have no seek action. Text-entry/modal capture and
hidden player views do not receive these clicks. Wheel and off modes retain their
existing behaviour; drag seeking is not implemented.

## Memory trends

Interactive sessions record memory counters at startup and once a minute in the
existing private, rotating session log. Samples include PID, uptime, RSS, JS heap
used/allocated/limit, external memory and ArrayBuffer memory, in MiB. No track
names, URLs, environment variables or heap contents are collected by the sampler.
A slow write skips samples instead of accumulating a backlog. The timer stops
on normal exit and does not keep Node alive.

Settings → Session diagnostics → R refresh / E export includes these samples.
RSS includes more than the JavaScript heap; external/ArrayBuffer values overlap
and should not be added together. A fatal OOM cannot guarantee a final sample.
These trends help narrow future investigations but do not identify retained
objects or prove the cause of the historical September crashes. Reports remain
local unless you explicitly share them.
