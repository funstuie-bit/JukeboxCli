import { execa } from "execa";
import { ffmpegPath } from "../bin/binaries";
import type { CoverImage } from "./graphics";

const images = new Map<string, Promise<CoverImage | null>>();
export type ArtworkFit = "cover" | "contain";
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

/** Encode a palette-reduced RGBA frame without losing its image-specific colours. */
export function encodeSixel(rgba: Uint8Array, width: number, height: number): string {
  if (rgba.length < width * height * 4 || width < 1 || height < 1) return "";
  const ESC = "\x1b", colours: number[][] = [], lookup = new Map<number, number>();
  const indices = new Int16Array(width * height).fill(-1);
  let overflow = false;
  for (let pixel = 0; pixel < indices.length; pixel++) {
    const at = pixel * 4;
    if (rgba[at + 3]! < 128) continue;
    const key = (rgba[at]! << 16) | (rgba[at + 1]! << 8) | rgba[at + 2]!;
    let colour = lookup.get(key);
    if (colour === undefined) {
      if (colours.length === 256) { overflow = true; break; }
      colour = colours.length; lookup.set(key, colour);
      colours.push([rgba[at]!, rgba[at + 1]!, rgba[at + 2]!]);
    }
    indices[pixel] = colour;
  }
  // Production ffmpeg supplies at most 256 adaptive colours. Bound arbitrary
  // callers too, rather than creating an unbounded terminal palette.
  if (overflow) {
    colours.length = 0;
    for (let i = 0; i < 256; i++) colours.push([
      Math.round(((i >> 5) & 7) * 255 / 7), Math.round(((i >> 2) & 7) * 255 / 7), Math.round((i & 3) * 255 / 3),
    ]);
    for (let pixel = 0; pixel < indices.length; pixel++) {
      const at = pixel * 4;
      indices[pixel] = rgba[at + 3]! < 128 ? -1 : (Math.round(rgba[at]! * 7 / 255) << 5) |
        (Math.round(rgba[at + 1]! * 7 / 255) << 2) | Math.round(rgba[at + 2]! * 3 / 255);
    }
  }
  const palette = colours.map((rgb, i) => `#${i};2;${rgb.map(c => Math.round(c * 100 / 255)).join(";")}`).join("");
  const runs = (values: Uint8Array) => {
    let out = "", length = values.length;
    while (length && values[length - 1] === 0) length--;
    for (let at = 0; at < length;) {
      let end = at + 1;
      while (end < length && values[end] === values[at]) end++;
      const count = end - at, char = String.fromCharCode(63 + values[at]!);
      out += count >= 4 ? `!${count}${char}` : char.repeat(count);
      at = end;
    }
    return out;
  };
  let body = "";
  for (let top = 0; top < height; top += 6) {
    const bands = new Map<number, Uint8Array>();
    for (let y = top; y < Math.min(height, top + 6); y++) for (let x = 0; x < width; x++) {
      const colour = indices[y * width + x]!;
      if (colour < 0) continue;
      let values = bands.get(colour);
      if (!values) { values = new Uint8Array(width); bands.set(colour, values); }
      values[x] = values[x]! | (1 << (y - top));
    }
    body += [...bands].map(([colour, values]) => `#${colour}${runs(values)}`).join("$");
    if (top + 6 < height) body += "-";
  }
  return `${ESC}P0;1;0q\"1;1;${width};${height}${palette}${body}${ESC}\\`;
}

export function loadSixelImage(
  source: string,
  width: number,
  height: number,
  fit: ArtworkFit = "cover",
): Promise<CoverImage | null> {
  const cacheKey = `sixel:${fit}:${source}:${width}x${height}`;
  const cached = images.get(cacheKey); if (cached) return cached;
  const work = (async () => {
    try {
      const { stdout } = await execa(ffmpegPath(), ["-nostdin", "-v", "error", "-i", source,
        "-map", "0:v:0", "-frames:v", "1", "-vf",
        `format=rgba,${artworkFilter(width, height, fit)}:color=black@0,split[a][b];` +
        "[a]palettegen=stats_mode=single[palette];[b][palette]paletteuse=dither=sierra2_4a",
        "-pix_fmt", "rgba", "-f", "rawvideo", "pipe:1"],
      { encoding: "buffer", timeout: 8000, maxBuffer: 8 * 1024 * 1024 });
      const rgba = Buffer.from(stdout);
      const sixel = encodeSixel(rgba, width, height);
      return sixel ? { png: new Uint8Array(), width, height, sixel } : null;
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

/** Album covers crop square by default; video previews contain the complete source. */
export function coverArtFilter(cols: number, rows: number, fit: ArtworkFit = "cover"): string {
  return artworkFilter(cols, rows * 2, fit);
}
function artworkFilter(width: number, height: number, fit: ArtworkFit): string {
  const crop = fit === "cover" ? "crop='min(iw,ih)':'min(iw,ih)'," : "";
  return `${crop}scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
}

/** How long a cached extraction survives before a re-read can refresh it. */
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  at: number;
  art: CoverArt | null;
  artFit?: ArtworkFit;
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
  for (const key of images.keys()) if (key.startsWith(`${filePath}:`) ||
      key.startsWith(`sixel:cover:${filePath}:`) || key.startsWith(`sixel:contain:${filePath}:`)) images.delete(key);
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
  fit: ArtworkFit = "cover",
): Promise<CoverArt | null> {
  const e = entryFor(filePath);
  if (e.art && e.art.cols === cols && e.art.rows === rows && e.artFit === fit) return e.art;
  // A different size or framing than cached: re-extract at selection changes.
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
        // Use the chosen framing, then fit the exact terminal pixel dimensions.
        "-vf",
        coverArtFilter(cols, rows, fit),
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
    e.artFit = fit;
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
