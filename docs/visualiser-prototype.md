# Audio-reactive visualiser

The eight-band visualiser is available as an experimental opt-in in Now Playing.
Normal launches retain the precomputed local-track waveform and do no live audio
analysis. Start the source checkout with:

```sh
npm run visualizer
```

Or enable it for an installed command:

```sh
JUKEBOXCLI_VISUALIZER=1 jukeboxcli
```

## What works

An mpv audio filter splits decoded audio into an unchanged playback branch and
an analysis branch. The latter measures eight octave-spaced frequency bands
(60, 125, 250, 500, 1000, 2000, 4000, 8000 Hz). This is **live band-pass RMS
energy**, not an FFT and not decorative/random animation. Analysis runs at
20 frames/sec; the terminal demo redraws at 10 frames/sec.

The Now Playing panel uses eight separated, filled vertical bars with fractional
block cells. It grows from two rows in a short split view to five rows in a tall
terminal, smooths fast attacks and slower decays, and leaves the terminal
background visible. This is not extra frequency resolution or a time-domain
waveform. Set `NO_COLOR=1` for uncoloured bars.

No microphone/system-audio capture, capture permissions, loopback driver, Python,
native helper or second media download. The visualiser uses the existing mpv
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

The fixture harness checks band peaks, silence, unchanged stereo PCM graph hashes,
settled pause position and stale readings after seeking. Unit tests cover filled
bar mapping, non-finite input, bounded parsing and timestamp selection.

The benchmark compares repeated baseline/filtered runs with generated pink noise.
It measures mpv CPU and RSS only, excluding Node, terminal rendering and startup;
short runs are not battery-life or release-performance guarantees.

Not yet verified: long-running radio, YouTube resolution/stream transitions,
preloaded queue transitions, speed changes, every sample format, Bluetooth/audio
device latency, independent Intel/Apple Silicon and terminal matrix. Eight broad
bands are an initial design, not a high-resolution FFT spectrum. There is no
claim of system-wide visualisation or native media-key support.

## Before enabling this by default

1. Make filter failure restart ordinary playback rather than requiring a launch
   without `JUKEBOXCLI_VISUALIZER=1`.
2. Keep checking process restart, track/preload changes, radio reconnect,
   seeking and decoder PTS resets. Keep pipe draining separate from rendering;
   close every descriptor on exit. Analyse a single stream, with bounded memory.
3. Add a saved Now Playing toggle and automatic waveform fallback, with hidden
   and small-window policies. Analysis already stays off in normal launches.
4. Add Full-App tests, muted real local/HTTP/radio/YouTube acceptance, sustained CPU/
   RSS and measured audible-clock alignment, followed by real-terminal visual
   review before enabling it. No audio-engine rewrite is required.

## Sources and implementation

The graph uses the primary [FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html):
`asplit`, `aresample`, `asetnsamples`, `bandpass`, `astats`, `ametadata`, `anullsink`.
Use installed filter help and the fixture harness to check local capabilities.
`src/player/spectrum.ts` builds the graph, parses metadata and renders filled bars;
`scripts/prototype-visualiser.ts` is the real-player acceptance/demo harness;
`scripts/benchmark-spectrum.ts` compares baseline and filtered mpv.
