// Prototype utilities only: deliberately not imported into production playback.
export const BANDS = [60, 125, 250, 500, 1000, 2000, 4000, 8000] as const;
export function spectrumGraph(input = "in", output = "out") {
  return `[${input}]asplit[${output}][analysis];[analysis]aresample=48000,asetnsamples=n=2400,asplit=${BANDS.length}` +
    BANDS.map((_, i) => `[b${i}]`).join("") + ";" + BANDS.map((hz, i) =>
      `[b${i}]bandpass=f=${hz}:w=1:t=o,astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=RMS_level,` +
      `ametadata=mode=print:key=lavfi.astats.Overall.RMS_level:file='pipe\\:${i + 3}':direct=1,anullsink`).join(";");
}
export interface Sample { time: number; db: number }
/** Bounded metadata line parser and timestamped history; never stores audio. */
export class BandMeter {
  private text = "";
  private time: number | null = null;
  readonly samples: Sample[] = [];
  count = 0;
  push(chunk: string) {
    // A stuck/malformed writer cannot grow the partial-line buffer indefinitely.
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
    // Select by playback time, not arrival: mpv decodes ahead of its audio output.
    return this.samples.findLast(s => s.time <= position + 0.025 && s.time >= position - 0.2);
  }
}
export function spectrumRows(db: number[], width: number, height: number): string[] {
  width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
  const cells = Array.from({ length: height }, () => Array<number>(width).fill(0));
  const dots = [[1, 2, 4, 64], [8, 16, 32, 128]];
  const levels = db.map(value => Number.isFinite(value) ? Math.max(0, Math.min(1, (value + 65) / 55)) : 0);
  // Interpolate the existing bands for presentation, not extra frequency resolution.
  // One dot per horizontal sample leaves the terminal background visible.
  for (let x = 0; x < width * 2; x++) {
    const band = x * Math.max(0, levels.length - 1) / (width * 2 - 1);
    const left = Math.floor(band), blend = band - left;
    const amplitude = (levels[left] ?? 0) * (1 - blend) + (levels[left + 1] ?? levels[left] ?? 0) * blend;
    if (amplitude <= 0) continue;
    const y = Math.round((1 - amplitude) * (height * 4 - 1));
    const row = cells[Math.floor(y / 4)]!, column = Math.floor(x / 2);
    row[column] = row[column]! | dots[x % 2]![y % 4]!;
  }
  return cells.map(row => row.map(bits => bits ? String.fromCharCode(0x2800 + bits) : " ").join(""));
}
