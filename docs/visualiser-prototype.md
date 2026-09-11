# Mac audio-reactive visualiser — feasibility prototype

Status: **parked until other project work is finished**, not integrated into Now Playing.
The production player retains its precomputed local track waveform. The prototype
is separate from the already implemented player search and lyrics features.

## What works

An mpv audio filter splits decoded audio into an unchanged playback branch and
an analysis branch. The latter measures eight octave-spaced frequency bands
(60, 125, 250, 500, 1000, 2000, 4000, 8000 Hz). This is **live band-pass RMS
energy**, not an FFT and not decorative/random animation. Analysis runs at
20 frames/sec; the terminal demo redraws at 10 frames/sec.

The preview uses a thin Braille-dot contour, interpolated between those same
eight readings, with a muted slate/lavender foreground and no background fill.
This is a lighter presentation, not extra frequency resolution or a time-domain
waveform. It leaves the terminal background visible; it does not change terminal
opacity. Set `NO_COLOR=1` for uncoloured dots.

No microphone/system-audio capture, capture permissions, loopback driver, Python,
native helper or second media download. The prototype uses the existing mpv
process's libavfilter and inherits eight metadata pipes from its parent. FFmpeg
CLI is used to generate/check test fixtures, not to decode a second stream during
playback. Audio on the playback branch is never downmixed for analysis.

Band readings carry media timestamps. The renderer chooses readings near mpv's
playback position, not simply the most recently decoded frame (which can be
ahead of the audible output). Pause blanks the demo, silence yields no dots,
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

The fixture harness checks band peaks, silence, unchanged stereo PCM graph hashes,
settled pause position and stale readings after seeking. Unit tests cover Braille
mapping, non-finite input, bounded parsing and timestamp selection.

The benchmark compares repeated baseline/filtered runs with generated pink noise.
It measures mpv CPU and RSS only, excluding Node, terminal rendering and startup;
short runs are not battery-life or release-performance guarantees.

Not yet verified: long-running radio, YouTube resolution/stream transitions,
preloaded queue transitions, speed changes, every sample format, Bluetooth/audio
device latency, independent Intel/Apple Silicon and terminal matrix. Eight broad
bands are an initial design, not a high-resolution FFT spectrum. There is no
claim of system-wide visualisation or native media-key support.

## Integration gate / next implementation

1. Add an opt-in capability-probed mpv tap behind the existing player interface.
   Filter failure must restore ordinary playback, not make music unusable.
2. Handle process restart, track/preload changes, radio reconnect, seeking and
   decoder PTS resets. Keep pipe draining separate from rendering; close every
   descriptor on exit. Analyse a single stream, with bounded memory.
3. Add a clear Now Playing visualiser toggle and waveform fallback, with pause,
   reduced-motion and hidden/small-window policies. Stop analysis work when
   disabled if filter reconfiguration proves safe; never block audio on a UI.
4. Full-App tests, muted real local/HTTP/radio/YouTube acceptance, sustained CPU/
   RSS and measured audible-clock alignment, followed by real-terminal visual
   review before enabling it. No audio-engine rewrite is required by this prototype.

## Sources and implementation

The graph uses the primary [FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html):
`asplit`, `aresample`, `asetnsamples`, `bandpass`, `astats`, `ametadata`, `anullsink`.
Use installed filter help and the fixture harness to check local capabilities.
`scripts/spectrum-core.ts` builds the graph/parses metadata/renders dotted contours;
`scripts/prototype-visualiser.ts` is the real-player acceptance/demo harness;
`scripts/benchmark-spectrum.ts` compares baseline and filtered mpv. None is
imported into production playback.
