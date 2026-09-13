export const BANDS = [60, 125, 250, 500, 1000, 2000, 4000, 8000] as const;

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

export function spectrumRows(db: number[], width: number, height: number, peakDb: number[] = []): string[] {
  width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
  const glyphs = " ▁▂▃▄▅▆▇█";
  if (!db.length) return Array.from({ length: height }, () => " ".repeat(width));
  const barWidth = width >= 6 ? 2 : 1;
  const gap = width >= 3 ? 1 : 0;
  const bars = Math.max(1, Math.floor((width + gap) / (barWidth + gap)));
  const renderWidth = bars * barWidth + (bars - 1) * gap;
  const leftPad = Math.floor((width - renderWidth) / 2);
  const rightPad = width - renderWidth - leftPad;
  const levels = resample(db.map(dbToLevel), bars);
  const peaks = peakDb.length ? resample(peakDb.map(dbToLevel), bars) : [];
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
