import { execa } from "execa";
import { ffmpegPath } from "../bin/binaries";
import type { CoverImage } from "./graphics";

const images = new Map<string, Promise<CoverImage | null>>();
/** Keep real image detail. Fit happens at placement, never by cropping the source. */
export function loadCoverImage(source: string, maxSize = 1024): Promise<CoverImage | null> {
  const cacheKey = `${source}:${maxSize}`;
  const cached = images.get(cacheKey); if (cached) return cached;
  const work = (async () => {
    try {
      const { stdout } = await execa(ffmpegPath(), ["-nostdin", "-v", "error", "-i", source,
        "-map", "0:v:0", "-frames:v", "1", "-vf", `scale=${maxSize}:${maxSize}:force_original_aspect_ratio=decrease`, "-pix_fmt", "rgb24",
        "-f", "image2pipe", "-c:v", "png", "pipe:1"], { encoding: "buffer", timeout: 8000, maxBuffer: 5 * 1024 * 1024 });
      const png = Buffer.from(stdout);
      if (maxSize <= 480 && png.length > 740000) return null;
      if (png.length < 24 || png.toString("hex", 0, 8) !== "89504e470d0a1a0a") return null;
      return { png, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    } catch { return null; }
  })();
  if (images.size >= 12) images.delete(images.keys().next().value!);
  images.set(cacheKey, work);
  return work;
}

/**
 * Cover art and waveform extraction for the Now Playing screen.
 *
 * Both are read from the audio file with the bundled ffmpeg, scaled to their
 * exact render size in the decoder (never decoded then resized in JS), and
 * cached per track. Extraction is best-effort: a file without embedded art
 * or a waveform probe that fails just means the screen falls back to its
 * text-only layout — playback is never blocked or retried on failure.
 */

/** One terminal "pixel": a pair of vertically-stacked RGB cells. */
export interface ArtCell {
  top: [number, number, number];
  bottom: [number, number, number];
}

export interface CoverArt {
  /** width in terminal columns (each = 2 pixel rows) */
  cols: number;
  /** height in terminal rows */
  rows: number;
  cells: ArtCell[];
  /** Mean luminance, 0..1 — the fallback glyph/label dims on dark covers. */
  brightness: number;
}

/** Coarse loudness envelope, one value 0..1 per bucket, for the waveform. */
export interface Waveform {
  /** 0..1 amplitude per column, always `buckets` long. */
  samples: number[];
}

/** How long a cached extraction survives before a re-read can refresh it. */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  art: CoverArt | null;
  wave: Waveform | null;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<void>>();

function entryFor(filePath: string): CacheEntry {
  let e = cache.get(filePath);
  if (!e || Date.now() - e.at > CACHE_TTL_MS) {
    e = { at: Date.now(), art: null, wave: null };
    cache.set(filePath, e);
  }
  return e;
}

/** Drop an entry (the file changed or was deleted). */
export function forgetArt(filePath: string): void {
  for (const key of images.keys()) if (key.startsWith(`${filePath}:`)) images.delete(key);
  cache.delete(filePath);
  inflight.delete(filePath);
}

/** Hard cap the cache so a very long session doesn't grow it forever. */
function trim(): void {
  if (cache.size <= 400) return;
  // Map preserves insertion order; drop the oldest quarter.
  const drop = Math.floor(cache.size / 4);
  let i = 0;
  for (const key of cache.keys()) {
    if (i++ >= drop) break;
    cache.delete(key);
  }
}

/**
 * Extract the embedded cover as half-block cells. `cols` x `rows` is the
 * terminal size (2*rows pixel lines). Returns null when the file has no
 * embedded art or ffmpeg fails — never throws.
 */
export async function loadCoverArt(
  filePath: string,
  cols: number,
  rows: number,
): Promise<CoverArt | null> {
  const e = entryFor(filePath);
  if (e.art && e.art.cols === cols && e.art.rows === rows) return e.art;
  // A different size than cached: re-extract (cheap; runs at track change).
  try {
    const px = rows * 2;
    const { stdout } = await execa(
      ffmpegPath(),
      [
        "-nostdin",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-map",
        "0:v",
        "-frames:v",
        "1",
        // Crop to the render aspect (cover-fit), then scale to exact pixels.
        "-vf",
        `scale=${cols}:${px}:force_original_aspect_ratio=decrease,pad=${cols}:${px}:(ow-iw)/2:(oh-ih)/2`,
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "pipe:1",
      ],
      { encoding: "buffer", timeout: 8000, maxBuffer: 4 * 1024 * 1024 },
    );
    // execa's buffer encoding yields Uint8Array; indexing works the same.
    const buf = stdout as Uint8Array | undefined;
    if (!buf || buf.length < cols * px * 4) return null;
    const cells: ArtCell[] = [];
    let bright = 0;
    for (let y = 0; y < px; y += 2) {
      for (let x = 0; x < cols; x++) {
        const iTop = (y * cols + x) * 4;
        const iBot = ((y + 1) * cols + x) * 4;
        const top: [number, number, number] = [
          buf[iTop]!,
          buf[iTop + 1]!,
          buf[iTop + 2]!,
        ];
        const bottom: [number, number, number] = [
          buf[iBot]!,
          buf[iBot + 1]!,
          buf[iBot + 2]!,
        ];
        cells.push({ top, bottom });
        bright +=
          (top[0] + top[1] + top[2] + bottom[0] + bottom[1] + bottom[2]) /
          (255 * 6);
      }
    }
    const art: CoverArt = {
      cols,
      rows,
      cells,
      brightness: bright / cells.length,
    };
    e.art = art;
    trim();
    return art;
  } catch {
    return null;
  }
}

/**
 * Precompute a loudness envelope for the waveform bar: ffmpeg's astats dumps
 * per-frame RMS, we bucket to `buckets` columns and normalize. Returns null
 * on failure — the bar degrades to a plain fill, never blocks playback.
 */
export async function loadWaveform(
  filePath: string,
  buckets: number,
): Promise<Waveform | null> {
  const e = entryFor(filePath);
  if (e.wave && e.wave.samples.length === buckets) return e.wave;
  try {
    const { stdout } = await execa(
      ffmpegPath(),
      [
        "-nostdin",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-map",
        "0:a",
        // Downsample first: RMS is amplitude, barely moved by 8kHz (~0.1dB on
        // a real track, invisible at waveform resolution), and it makes the
        // pass ~89x realtime so even a 10-minute track fits the timeout.
        // Verified on the bundled ffmpeg: no asetnsrc filter exists (it was
        // in an early draft and aborts the graph); `length=` on astats is
        // ignored — readings arrive per codec frame (~20ms opus), which the
        // bucketing below handles at any density. Output lands on stdout.
        "-af",
        "aresample=8000," +
          "astats=metadata=1:reset=1," +
          "ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-",
        "-f",
        "null",
        "-",
      ],
      { timeout: 15000, maxBuffer: 32 * 1024 * 1024 },
    );
    const rms: number[] = [];
    for (const m of stdout.matchAll(
      /lavfi\.astats\.Overall\.RMS_level=(-?[\d.]+)/g,
    )) {
      const v = Number(m[1]);
      // Silence prints "-inf" which Number() casts NaN; skip those frames.
      if (Number.isFinite(v)) rms.push(v);
    }
    if (rms.length < 4) return null;
    const per = rms.length / buckets;
    const samples: number[] = [];
    let max = 0;
    for (let b = 0; b < buckets; b++) {
      const s = Math.floor(b * per);
      const t = Math.max(s + 1, Math.floor((b + 1) * per));
      let m = -Infinity;
      for (let i = s; i < t && i < rms.length; i++) m = Math.max(m, rms[i]!);
      // dB (typically -60..0) → 0..1 with a floor so silence isn't a void.
      const v = Math.max(0.06, (m + 60) / 60);
      samples.push(v);
      if (v > max) max = v;
    }
    // Normalize to the track's own peak so quiet masters still show shape.
    const wave: Waveform = {
      samples: samples.map((v) => Math.min(1, v / (max || 1))),
    };
    e.wave = wave;
    trim();
    return wave;
  } catch {
    return null;
  }
}

/**
 * Load both art and waveform for a track once; concurrent callers share one
 * run. Fires-and-forget usage is fine — every getter caches.
 */
export function ensureTrackVisuals(
  filePath: string,
  cols: number,
  rows: number,
  buckets: number,
): Promise<void> {
  const key = `${filePath}:${cols}x${rows}:${buckets}`;
  let p = inflight.get(key);
  if (!p) {
    p = (async () => {
      await Promise.all([
        loadCoverArt(filePath, cols, rows),
        loadWaveform(filePath, buckets),
      ]);
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, p);
  }
  return p;
}
