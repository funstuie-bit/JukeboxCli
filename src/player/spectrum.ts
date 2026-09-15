export const BANDS = [60, 125, 250, 500, 1000, 2000, 4000, 8000] as const;
export const SPECTRUM_MODES = ["classic", "smooth", "mirror", "outline", "bricks", "mosaic"] as const;
export type SpectrumMode = typeof SPECTRUM_MODES[number];
const SPECTRUM_LABELS: Record<SpectrumMode, string> = {
  classic: "Classic Peak",
  smooth: "Smooth",
  mirror: "Bass Mirror",
  outline: "Outline",
  bricks: "Bricks",
  mosaic: "Mosaic",
};

export function spectrumModeLabel(mode: SpectrumMode): string {
  return SPECTRUM_LABELS[mode];
}

/** Enable live analysis on supported desktop platforms, with an explicit off switch. */
export function visualizerEnabled(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (env.JUKEBOXCLI_VISUALIZER === "0") return false;
  return platform === "linux" || platform === "darwin" || env.JUKEBOXCLI_VISUALIZER === "1";
}

export function nextSpectrumMode(mode: SpectrumMode = "classic"): SpectrumMode {
  return SPECTRUM_MODES[(SPECTRUM_MODES.indexOf(mode) + 1) % SPECTRUM_MODES.length]!;
}

export function spectrumGraph(input = "in", output = "out") {
  return `[${input}]asplit[${output}][analysis];[analysis]aresample=48000,asetnsamples=n=2400,asplit=${BANDS.length}` +
    BANDS.map((_, i) => `[b${i}]`).join("") + ";" + BANDS.map((hz, i) =>
      `[b${i}]bandpass=f=${hz}:w=1:t=o,astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,` +
      `ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file='pipe\\:${i + 3}':direct=1,anullsink`).join(";");
}

export interface Sample { time: number; db: number }

const dbToLevel = (value: number) => Number.isFinite(value)
  ? Math.max(0, Math.min(1, (value + 65) / 55))
  : 0;
const levelToDb = (value: number) => value <= 0 ? -120 : value * 55 - 65;

export interface SpectrumFrame { body: number[]; peaks: number[] }

/** Fast attack, eased decay and held/falling caps for a classic LED meter. */
export class SpectrumDynamics {
  private body: number[] = [];
  private peaks: number[] = [];
  private holds: number[] = [];

  update(db: number[], paused = false): SpectrumFrame {
    if (paused) {
      this.reset(db.length);
      return { body: this.body.map(levelToDb), peaks: this.peaks.map(levelToDb) };
    }
    const target = db.map(dbToLevel);
    if (this.body.length !== target.length) this.reset(target.length);
    for (let i = 0; i < target.length; i++) {
      const previous = this.body[i] ?? 0;
      const next = target[i] ?? 0;
      this.body[i] = previous + (next - previous) * (next > previous ? 0.78 : 0.18);
      if (this.body[i]! >= (this.peaks[i] ?? 0)) {
        this.peaks[i] = this.body[i]!;
        this.holds[i] = 7;
      } else if ((this.holds[i] ?? 0) > 0) {
        this.holds[i]!--;
      } else {
        this.peaks[i] = Math.max(this.body[i]!, (this.peaks[i] ?? 0) - 0.045);
      }
    }
    return { body: this.body.map(levelToDb), peaks: this.peaks.map(levelToDb) };
  }

  reset(size = this.body.length) {
    this.body = Array(size).fill(0);
    this.peaks = Array(size).fill(0);
    this.holds = Array(size).fill(0);
  }
}

/** Bounded metadata line parser and timestamped history; never stores audio. */
export class BandMeter {
  private text = "";
  private time: number | null = null;
  readonly samples: Sample[] = [];
  count = 0;

  push(chunk: string) {
    this.text = (this.text + chunk).slice(-8192);
    let end: number;
    while ((end = this.text.indexOf("\n")) >= 0) {
      const line = this.text.slice(0, end); this.text = this.text.slice(end + 1);
      if (line.startsWith("frame:")) {
        const t = Number(line.match(/pts_time:([\d.e+-]+)/)?.[1]);
        this.time = Number.isFinite(t) ? t : null;
      } else if (line.startsWith("lavfi.astats.Overall.RMS_level=") && this.time !== null) {
        const raw = line.split("=")[1], db = raw === "-inf" ? -120 : Number(raw);
        if (!Number.isFinite(db)) continue;
        this.samples.push({ time: this.time, db: Math.max(-120, Math.min(0, db)) });
        if (this.samples.length > 128) this.samples.shift();
        this.count++;
      }
    }
  }

  clear() { this.samples.length = 0; this.text = ""; this.time = null; }

  at(position: number): Sample | undefined {
    return this.samples.findLast(s => s.time <= position + 0.025 && s.time >= position - 0.2);
  }
}

function resample(values: number[], count: number): number[] {
  if (!values.length || count < 1) return [];
  if (values.length === 1 || count === 1) return [values[Math.floor((values.length - 1) / 2)] ?? 0];
  return Array.from({ length: count }, (_, i) => {
    const position = i * (values.length - 1) / (count - 1);
    const left = Math.floor(position), fraction = position - left;
    return (values[left] ?? 0) * (1 - fraction) + (values[Math.min(values.length - 1, left + 1)] ?? 0) * fraction;
  });
}

function mirrorBands(values: number[], count: number): number[] {
  if (!values.length || count < 1) return [];
  if (count === 1) return [values[0] ?? 0];
  return Array.from({ length: count }, (_, i) => {
    const centre = (count - 1) / 2;
    const distance = Math.abs(i - centre) / Math.max(0.5, centre);
    const position = distance * (values.length - 1);
    const left = Math.floor(position), fraction = position - left;
    return (values[left] ?? 0) * (1 - fraction) + (values[Math.min(values.length - 1, left + 1)] ?? 0) * fraction;
  });
}

/** Measured bands as hollow meters; unlike a contour these remain distinct at wide widths. */
function outlineRows(levels: number[], width: number, height: number): string[] {
  if (width < 3) {
    const columns = resample(levels, width);
    return Array.from({ length: height }, (_, row) => {
      const fromBottom = height - row - 1;
      return columns.map(level => level > fromBottom / height ? "│" : " ").join("");
    });
  }
  const count = Math.max(1, Math.min(levels.length, Math.floor((width + 1) / 4)));
  const bands = resample(levels, count);
  const gap = count > 1 ? 1 : 0;
  const barWidth = Math.max(3, Math.floor((width - gap * (count - 1)) / count));
  const renderWidth = barWidth * count + gap * (count - 1);
  const left = Math.floor((width - renderWidth) / 2), right = width - renderWidth - left;
  return Array.from({ length: height }, (_, row) => {
    const body = bands.map(level => {
      const filled = level > 0 ? Math.max(1, Math.min(height, Math.ceil(level * height))) : 0;
      const top = height - filled;
      if (!filled || row < top) return " ".repeat(barWidth);
      if (filled === 1 || row === height - 1) return "└" + "─".repeat(barWidth - 2) + "┘";
      if (row === top) return "┌" + "─".repeat(barWidth - 2) + "┐";
      return "│" + " ".repeat(barWidth - 2) + "│";
    }).join(" ".repeat(gap));
    return " ".repeat(left) + body + " ".repeat(right);
  });
}

/** Eight measured bands as chunky, half-height blocks with visible gutters. */
function brickRows(levels: number[], width: number, height: number): string[] {
  const bands = levels.slice(0, Math.max(1, Math.min(levels.length, width)));
  const gap = width >= bands.length * 2 - 1 ? 1 : 0;
  const barWidth = Math.max(1, Math.floor((width - gap * (bands.length - 1)) / bands.length));
  const renderWidth = barWidth * bands.length + gap * (bands.length - 1);
  const left = Math.floor((width - renderWidth) / 2), right = width - renderWidth - left;
  return Array.from({ length: height }, (_, row) => {
    const threshold = (height - row - 1) / height;
    const body = bands.map(level => (level > threshold ? "▄" : " ").repeat(barWidth)).join(" ".repeat(gap));
    return " ".repeat(left) + body + " ".repeat(right);
  });
}

/** Fixed band-wired tiles: loud passages illuminate progressively denser texture. */
function mosaicRows(levels: number[], width: number, height: number): string[] {
  const tiles = Math.max(1, Math.floor((width + 1) / 3));
  const renderWidth = tiles * 2 + tiles - 1;
  const left = Math.max(0, Math.floor((width - renderWidth) / 2));
  const shades = " ░▒▓█";
  return Array.from({ length: height }, (_, row) => {
    const body = Array.from({ length: tiles }, (_, tile) => {
      const verticalBand = height === 1 ? Math.floor((levels.length - 1) / 2)
        : Math.round((height - row - 1) * (levels.length - 1) / (height - 1));
      const jitter = ((row * 11 + tile * 7) % 3) - 1;
      const band = Math.max(0, Math.min(levels.length - 1, verticalBand + jitter));
      const threshold = 0.06 + ((row * 37 + tile * 61 + 17) % 100) / 100 * 0.72;
      const intensity = Math.max(0, Math.min(1, ((levels[band] ?? 0) - threshold) / Math.max(0.01, 1 - threshold)));
      const glyph = shades[Math.min(4, Math.ceil(intensity * 4))]!;
      return glyph.repeat(2);
    }).join(" ");
    return " ".repeat(left) + body + " ".repeat(Math.max(0, width - left - renderWidth));
  });
}

export function spectrumRows(
  db: number[], width: number, height: number, peakDb: number[] = [], mode: SpectrumMode = "classic",
): string[] {
  width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
  const glyphs = " ▁▂▃▄▅▆▇█";
  if (!db.length) return Array.from({ length: height }, () => " ".repeat(width));
  const source = db.map(dbToLevel);
  if (mode === "outline") return outlineRows(source, width, height);
  if (mode === "bricks") return brickRows(source, width, height);
  if (mode === "mosaic") return mosaicRows(source, width, height);
  const barWidth = mode === "classic" && width >= 6 ? 2 : 1;
  const gap = mode === "classic" && width >= 3 ? 1 : 0;
  const bars = Math.max(1, Math.floor((width + gap) / (barWidth + gap)));
  const renderWidth = bars * barWidth + (bars - 1) * gap;
  const leftPad = Math.floor((width - renderWidth) / 2);
  const rightPad = width - renderWidth - leftPad;
  const levels = mode === "mirror" ? mirrorBands(source, bars) : resample(source, bars);
  const peaks = mode === "classic" && peakDb.length ? resample(peakDb.map(dbToLevel), bars) : [];
  return Array.from({ length: height }, (_, row) => {
    const fromBottom = height - row - 1;
    const content = levels.map((level, band) => {
      const remaining = level * height * 8 - fromBottom * 8;
      let glyph = glyphs[Math.max(0, Math.min(8, Math.ceil(remaining)))]!;
      const peak = peaks[band] ?? 0;
      const peakRow = Math.min(height - 1, Math.floor(peak * height));
      if (peak > level + 0.5 / height && peakRow === fromBottom && remaining <= 0) glyph = "▀";
      return glyph.repeat(barWidth);
    }).join(" ".repeat(gap));
    return " ".repeat(leftPad) + content + " ".repeat(rightPad);
  });
}
