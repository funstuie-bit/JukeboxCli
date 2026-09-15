# Audio-reactive visualiser

## Fullscreen effects prototype

Linux also has an optional, separate projectM/MilkDrop graphics window. Install
`projectM-pulseaudio`, then press uppercase `F` in Now Playing or launch it from
**Settings → Player appearance**. It opens on the real display in fullscreen
and captures the active PipeWire/PulseAudio output. Close that graphics window
to return; playback and the compact terminal visualiser continue independently.

This first prototype hears the whole active system output, so audio from another
application can affect its animation. JukeboxCLI does not start a second copy of
the song. The ordinary terminal player has no projectM dependency.

The eight-band visualiser is enabled by default in Now Playing on Mac and Linux.
Press lowercase `v` to cycle its six styles. Uppercase `V` controls decorative
animation, not the audio-reactive visualiser. Set `JUKEBOXCLI_VISUALIZER=0 jukeboxcli`
to use the precomputed local-track waveform and disable live analysis.

## What works

An mpv audio filter splits decoded audio into an unchanged playback branch and
an analysis branch. The latter measures eight octave-spaced frequency bands
(60, 125, 250, 500, 1000, 2000, 4000, 8000 Hz). This is **live band-pass RMS
energy**, not an FFT and not decorative/random animation. Analysis and the
Now Playing panel update at up to 20 frames/sec; the standalone demo redraws at
10 frames/sec. The same decoded-audio path now drives local, online and live
radio playback; live stations no longer hide the panel.

The Now Playing panel uses a classic LED-style presentation inspired by the
useful parts of cliamp's visual hierarchy: narrow two-cell bars, one-cell gaps,
linear interpolation between the eight readings, fast attack, eased decay, and
held/falling peak caps. It leaves the terminal background visible. The extra
columns improve motion and shape but are not extra measured frequency resolution
or an FFT. Set `NO_COLOR=1` for uncoloured bars.

Press `v` in Now Playing to cycle six saved presentations:

- **Classic Peak** — separated two-cell LED bars with held/falling caps.
- **Smooth** — a continuous one-cell skyline, low frequencies on the left.
- **Bass Mirror** — a dense symmetric skyline with bass at the centre.
- **Outline** — a minimal interpolated contour with no filled area.
- **Bricks** — the eight measured bands as chunky half-height blocks and gutters.
- **Mosaic** — fixed frequency-wired tiles whose density and shade follow band energy.

The latter three take visual-design inspiration from cliamp but use original
rendering over JukeboxCli's existing measurements; no cliamp source is included.
The selected mode is stored in JukeboxCli's config. Switching presentation does
not restart mpv, add analysis processes or change the audio measurements.
When the embedded Player is too narrow for side-by-side panels but has at least
22 rows, it shows artwork and the spectrum instead of duplicating the queue;
the complete queue remains available in section `7`.

No microphone/system-audio capture, capture permissions, loopback driver, Python,
native helper or second media download. The visualiser uses the existing mpv
process's libavfilter and inherits eight metadata pipes from its parent. FFmpeg
CLI is used to generate/check test fixtures, not to decode a second stream during
playback. Audio on the playback branch is never downmixed for analysis.

Band readings carry media timestamps. The renderer chooses readings near mpv's
playback position, not simply the most recently decoded frame (which can be
ahead of the audible output). Pause blanks the demo, silence yields no bars,
and seek clears old histories. Stale/missing samples render blank. Measurements
are pre-volume: muting makes the test silent but does not erase source energy.

Each band retains at most 128 scalar samples and an 8 KiB partial-text buffer;
no audio samples/files are accumulated by the meter. All pipes are continuously
drained even without a visible demo, avoiding UI rendering backpressure.

## Reproduce safely

From this checkout, with mpv and ffmpeg on PATH:

```sh
npx tsx scripts/prototype-visualiser.ts
npx tsx scripts/prototype-visualiser.ts --demo
npx tsx scripts/smoke-player-visualizer.ts
npx tsx scripts/benchmark-spectrum.ts
```

The acceptance harness creates its own private temporary directory and generated
stereo tones: 125 Hz, then 4 kHz, then silence. Opposite-phase channels check that
mono cancellation cannot hide the signal. Playback is muted through real audio
output by default; `--null-output` is available for headless diagnostics. No
library, favourites, queue, cookies, music files or application config are read
or changed. Fixture directories are retained and their paths printed. Demo ends
automatically; Ctrl+C cancels with process/terminal cleanup.

The harness verifies unchanged float32 stereo PCM hashes through the same graph
in FFmpeg, then exercises actual mpv band readings, stereo channel count, pause,
forward/backward seek and silence. PCM comparison validates the graph, not a
claim of bit-perfect hardware output. Pause checks use the settled mpv clock:
the audio device can drain briefly after pause, and property events can lag.
The demo responds to current terminal size; unit tests cover small dimensions.

## Verification and limits

- Actual mpv 0.41.0 / FFmpeg libraries 9.0.1 on the development Mac passed.
- 125 Hz peaks in the 125 Hz band; 4 kHz peaks in the 4 kHz band after a seek.
  Silence settles below -80 dB in all bands, represented by a -120 dB floor.
- Stereo output graph hashes match; pause clock freezes after settling;
  backwards seek discards prior high-frequency/silent readings.
- A 70×18 real PTY demo exercised low/high response, pause blanking and silence.
- Short repeated baseline/filtered CPU comparisons use generated stereo pink
  noise and muted real mpv output. They measure **mpv CPU only**, excluding Node,
  terminal rendering and startup. Numbers are diagnostic, not a battery/runtime
  or release-performance guarantee. On Apple M1 Max / macOS 26.4.1, a repeated
  run measured 4.0%/4.0% baseline versus 6.6%/6.6% filtered (about 2.6 percentage
  points additional mpv CPU). RSS varied 147–179 MiB baseline / 148–150 MiB
  filtered, so no memory-overhead conclusion is drawn from this short run.
- Tests cover LED interpolation and peak motion, missing/non-finite readings,
  bounded metadata parsing, timestamp selection, stale history clearing and
  honest silent rendering.

Not yet verified: long-running radio, YouTube resolution/stream transitions,
preloaded queue transitions, speed changes, every sample format, Bluetooth/audio
device latency, independent Intel/Apple Silicon and terminal matrix. Eight broad
bands are an initial design, not a high-resolution FFT spectrum. There is no
claim of system-wide visualisation or native media-key support.

## Remaining integration gates

1. Make filter failure restore ordinary playback rather than requiring a Linux
   relaunch with `JUKEBOXCLI_VISUALIZER=0`.
2. Keep checking process restart, track/preload changes, radio reconnect, seeking and
   decoder PTS resets. Keep pipe draining separate from rendering; close every
   descriptor on exit. Analyse a single stream, with bounded memory.
3. Add a saved Now Playing visualiser toggle and waveform fallback, with hidden
   and small-window policies. Stop analysis work when
   disabled if filter reconfiguration proves safe; never block audio on a UI.
4. Full-App tests, muted real local/HTTP/radio/YouTube acceptance, sustained CPU/
   RSS and measured audible-clock alignment; then Stu's visual acceptance before
   enabling or promoting it. No rewrite of the audio engine is justified yet.

## Sources and implementation

The graph uses the primary [FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html):
`asplit`, `aresample`, `asetnsamples`, `bandpass`, `astats`, `ametadata`, `anullsink`.
Installed filter help and actual mpv execution verified the available options.
`src/player/spectrum.ts` builds the graph, parses metadata and renders the LED spectrum;
`scripts/prototype-visualiser.ts` is the real-player acceptance/demo harness;
`scripts/benchmark-spectrum.ts` compares baseline and filtered mpv.
