import { cleanText } from "../util/format";

export const EQ_BANDS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;
export interface Equalizer { enabled: boolean; gains: number[] }
export const EQ_PRESETS: Record<string, number[]> = {
  Flat: EQ_BANDS.map(() => 0),
  Warm: [3, 2, 1, 0, 0, 0, -1, -1, 0, 0],
  Voice: [-2, -2, -1, 0, 2, 3, 2, 0, -1, -1],
  Electronic: [3, 2, 0, -1, -2, 0, 1, 2, 3, 2],
};
export function validEqualizer(value: unknown): Equalizer {
  const v = value as Partial<Equalizer> | undefined;
  return { enabled: v?.enabled === true, gains: EQ_BANDS.map((_, i) => {
    const n = v?.gains?.[i]; return typeof n === "number" && Number.isFinite(n) ? Math.max(-12, Math.min(12, n)) : 0;
  }) };
}
/** A separate labelled stage: never replace analysis/lifetime pipes. */
export function equalizerFilter(value: Equalizer): string | null {
  const eq = validEqualizer(value);
  if (!eq.enabled || eq.gains.every(n => n === 0)) return null;
  const headroom = Math.max(0, ...eq.gains);
  // A 48 kHz processing rate keeps the 16 kHz band valid for speech sources too.
  return `@jukebox-eq:lavfi=[aresample=48000,volume=-${headroom}dB,` + EQ_BANDS.map((f, i) => `equalizer=f=${f}:t=o:w=1:g=${eq.gains[i]}`).join(",") + "]";
}
export interface AudioDetails { codec?: string; bitrate?: number; decodedRate?: number; outputRate?: number; channels?: string }
export interface Chapter { title: string; time: number }
export function validChapters(value: unknown): Chapter[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 1000).flatMap((v, i) => v && typeof v.time === "number" && Number.isFinite(v.time) && v.time >= 0
    ? [{ title: cleanText(typeof v.title === "string" ? v.title : `Chapter ${i + 1}`).slice(0, 160), time: v.time }] : [])
    .sort((a, b) => a.time - b.time).filter((v, i, xs) => !i || v.time !== xs[i - 1]!.time);
}
export function audioDetailsLabel(v?: AudioDetails): string {
  if (!v) return "Audio format pending";
  const rate = (n: number) => `${Math.round(n / 100) / 10} kHz`;
  return [v.codec, v.bitrate ? `${Math.round(v.bitrate / 1000)} kb/s` : undefined,
    v.decodedRate ? `decoded ${rate(v.decodedRate)}` : undefined,
    v.outputRate ? `output ${rate(v.outputRate)}` : undefined, v.channels].filter(Boolean).join(" · ") || "Audio format unavailable";
}
