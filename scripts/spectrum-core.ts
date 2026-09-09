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
  const glyphs = " ▁▂▃▄▅▆▇█";
  return Array.from({ length: height }, (_, row) => Array.from({ length: width }, (_, col) => {
    const value = db[Math.min(db.length - 1, Math.floor(col * db.length / width))] ?? -120;
    const amplitude = Math.max(0, Math.min(1, (value + 65) / 55));
    return glyphs[Math.max(0, Math.min(8, Math.round((amplitude * height - (height - row - 1)) * 8)))];
  }).join(""));
}
