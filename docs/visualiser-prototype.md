# Mac audio-reactive visualiser — feasibility prototype

Status: **parked until other project work is finished**, not integrated into Now Playing.
the maintainer's latest feedback (2026-09-08): dots are better, but the single-line contour
still looks odd and the demo is too short. Retain the prototype; no further
presentation, demo-length or integration work until explicitly revisited. Production
JukeboxCli now uses dev.11 (search update) with its precomputed track waveform. the maintainer authorised
this feasibility work on 2026-09-08; the search-bar idea stays parked and separate
YouTube Music sign-in has been removed from the roadmap.

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
opacity. Set `NO_COLOR=1` for uncoloured dots. This is a single, non-blocking polish
pass requested by the maintainer, not a commitment to further visual parity work.

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

## Evidence and limits

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
- 596 tests pass / 4 inherited skips, including Braille mapping/interpolation,
  missing/non-finite readings, bounded metadata parsing,
  timestamp selection, stale history clearing and honest silent rendering.
  Typecheck, build and distribution-import guard pass. App runtime is unchanged.

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
   RSS and measured audible-clock alignment; then the maintainer's visual acceptance before
   enabling or promoting it. No rewrite of the audio engine is justified yet.

## Sources and implementation

documentation lookup's web route checked the primary [FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html):
`asplit`, `aresample`, `asetnsamples`, `bandpass`, `astats`, `ametadata`, `anullsink`.
Installed filter help and actual mpv execution verified the available options.
`scripts/spectrum-core.ts` builds the graph/parses metadata/renders dotted contours;
`scripts/prototype-visualiser.ts` is the real-player acceptance/demo harness;
`scripts/benchmark-spectrum.ts` compares baseline and filtered mpv. None is
imported into production playback.
