import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { stripVTControlCharacters } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import { paths } from "../config/paths";
import { cleanText } from "../util/format";
import { isLive, isStream, type PlayableTrack } from "./media";

const TEXT_LIMIT = 64 * 1024;
const CACHE_LIMIT = 64;
export interface LyricLine { at: number; text: string }
export interface Lyrics {
  lines: LyricLine[];
  plain: string[];
  instrumental?: boolean;
  source: "Local LRC" | "Cache · LRCLIB" | "LRCLIB";
}
export interface LyricsResult { lyrics?: Lyrics; message: string }
interface Signature { title: string; artist: string; album?: string; duration?: number }
interface Cached { key: string; savedAt: number; plainLyrics: string; syncedLyrics: string; instrumental: boolean }
const lyricText = (value: string) => {
  const stripped = stripVTControlCharacters(value).replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();
  return stripped ? cleanText(stripped) : "";
};

/** Basic line timing, repeated timestamps and millisecond offsets. No invented word sync. */
export function parseLrc(raw: string): Pick<Lyrics, "lines" | "plain"> {
  if (Buffer.byteLength(raw) > TEXT_LIMIT) throw Error("Lyrics file is too large (64 KiB maximum).");
  const rows = raw.replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, 2048);
  const offset = Number([...raw.matchAll(/\[offset:([+-]?\d+)\]/gi)].at(-1)?.[1] ?? 0) / 1000;
  const lines: LyricLine[] = []; const plain: string[] = [];
  for (const row of rows) {
    const times = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?\]/g)];
    const text = lyricText(row.replace(/\[(?:\d{1,3}:[0-5]\d(?:\.\d{1,3})?|[a-z]+:[^\]]*)\]/gi, "")
      .replace(/<\d{1,3}:[0-5]\d(?:\.\d{1,3})?>/g, "")).trim();
    if (text) plain.push(text);
    for (const match of times) {
      if (lines.length >= 4096) break;
      const at = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? "0"}`) + offset;
      if (Number.isFinite(at)) lines.push({ at: Math.max(0, Math.round(at * 1000) / 1000), text });
    }
  }
  lines.sort((a, b) => a.at - b.at);
  return { lines, plain };
}
export function lyricIndex(lines: LyricLine[], seconds: number): number {
  let lo = 0, hi = lines.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (lines[mid]!.at <= seconds) lo = mid + 1; else hi = mid; }
  return lo - 1;
}

export function lyricsSignature(track: PlayableTrack, broadcast?: string): Signature | null {
  let title = track.title, artist = track.artist;
  if (isLive(track)) {
    if (!broadcast || /\b(mixed by|dj set|live set|radio show|episode|mix)\b|#\d/i.test(broadcast)) return null;
    const parts = broadcast.split(/\s+[-–—]\s+/);
    if (parts.length !== 2) return null;
    [artist, title] = parts as [string, string];
  }
  title = lyricText(title); artist = lyricText(artist ?? "");
  if (!title || !artist || title.length > 200 || artist.length > 200) return null;
  const duration = !isLive(track) && track.durationSec && track.durationSec >= 1 && track.durationSec <= 3600 ? Math.round(track.durationSec) : undefined;
  return { title, artist, album: !isLive(track) && track.album ? cleanText(track.album).slice(0, 200) : undefined, duration };
}
const norm = (s: string) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
const keyFor = (s: Signature) => createHash("sha256").update(JSON.stringify(s)).digest("hex");

async function readBounded(file: string, limit: number): Promise<string> {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > limit) throw Error("Lyrics file is too large or is not a regular file.");
    const buf = Buffer.alloc(limit + 1);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    if (bytesRead > limit) throw Error("Lyrics file is too large.");
    return buf.subarray(0, bytesRead).toString("utf8");
  } finally { await handle.close(); }
}
function validCache(value: unknown): value is Cached {
  const c = value as Cached;
  return !!c && /^[a-f0-9]{64}$/.test(c.key) && Number.isFinite(c.savedAt) &&
    typeof c.plainLyrics === "string" && typeof c.syncedLyrics === "string" && typeof c.instrumental === "boolean" &&
    Buffer.byteLength(c.plainLyrics) + Buffer.byteLength(c.syncedLyrics) <= TEXT_LIMIT;
}
function decoded(c: Cached, source: Lyrics["source"]): Lyrics {
  const timed = parseLrc(c.syncedLyrics);
  return { lines: timed.lines, plain: c.plainLyrics ? parseLrc(c.plainLyrics).plain : timed.plain, instrumental: c.instrumental, source };
}
async function responseText(response: Response): Promise<string> {
  const limit = 256 * 1024;
  if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel(); throw Error("Lyrics response is too large."); }
  const reader = response.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length; if (size > limit) throw Error("Lyrics response is too large."); chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** One sequential provider client per app; cache is bounded and private, never beside music. */
export function createLyricsService({ fetcher = fetch, cacheFile = path.join(paths.cache, "lyrics-v1.json"), now = Date.now, spacing = 300 }:
  { fetcher?: typeof fetch; cacheFile?: string; now?: () => number; spacing?: number } = {}) {
  let tail: Promise<unknown> = Promise.resolve();
  let nextRequest = 0, blockedUntil = 0;
  const misses = new Map<string, number>();
  const readCache = async (): Promise<Cached[]> => {
    try {
      const data = JSON.parse(await readBounded(cacheFile, 5 * 1024 * 1024));
      return data.version === 1 && Array.isArray(data.entries) ? data.entries.slice(0, CACHE_LIMIT).filter(validCache) : [];
    } catch { return []; } // expendable cache, never touch a music file
  };
  return async (track: PlayableTrack, options: { signal: AbortSignal; online: boolean; broadcast?: string }): Promise<LyricsResult> => {
    const { signal, online, broadcast } = options; signal.throwIfAborted();
    if (!isStream(track)) {
      const base = track.filePath.slice(0, track.filePath.length - path.extname(track.filePath).length);
      for (const file of [...new Set([`${base}.lrc`, `${track.filePath}.lrc`])]) {
        try {
          const text = await readBounded(file, TEXT_LIMIT); signal.throwIfAborted();
          const lyrics = { ...parseLrc(text), source: "Local LRC" as const };
          return lyrics.lines.length || lyrics.plain.length ? { lyrics, message: "" } : { message: "Local LRC has no usable lyrics." };
        } catch (e) {
          signal.throwIfAborted();
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") return { message: "Cannot read local LRC (check permissions and the 64 KiB limit)." };
        }
      }
    }
    const signature = lyricsSignature(track, broadcast);
    if (!signature) return { message: isLive(track) ? "Waiting for a clear Artist - Song broadcast title; DJ mixes are skipped." : "Lyrics unavailable: artist and song title are required." };
    const key = keyFor(signature);
    const cached = (await readCache()).find(c => c.key === key); signal.throwIfAborted();
    if (cached) return { lyrics: decoded(cached, "Cache · LRCLIB"), message: "" };
    if (!online) return { message: "No local/cached lyrics. L enables LRCLIB lookup (sends artist/title, album and duration)." };
    const job = tail.catch(() => {}).then(async (): Promise<LyricsResult> => {
      signal.throwIfAborted();
      const previous = (await readCache()).find(c => c.key === key); signal.throwIfAborted();
      if (previous) return { lyrics: decoded(previous, "Cache · LRCLIB"), message: "" };
      if (now() < blockedUntil) return { message: "LRCLIB rate limited; retry later (Retry-After is honoured)." };
      if ((misses.get(key) ?? 0) > now()) return { message: "Lyrics unavailable for this exact recording." };
      if (nextRequest > now()) await delay(nextRequest - now(), undefined, { signal });
      signal.throwIfAborted();
      const url = new URL("https://lrclib.net/api/get");
      url.searchParams.set("track_name", signature.title); url.searchParams.set("artist_name", signature.artist);
      if (signature.album) url.searchParams.set("album_name", signature.album);
      if (signature.duration) url.searchParams.set("duration", String(signature.duration));
      try {
        const response = await fetcher(url.href, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), redirect: "error", credentials: "omit",
          headers: { "User-Agent": "JukeboxCli/0.1.0-dev.9 (https://github.com/funstuie-bit/JukeboxCli)", Accept: "application/json" } });
        if (!response.ok) {
          await response.body?.cancel();
          if (response.status === 429) {
            const retry = response.headers.get("retry-after") ?? "60";
            const seconds = Number(retry);
            blockedUntil = Math.max(now() + 1000, Number.isFinite(seconds) ? now() + seconds * 1000 : Date.parse(retry) || now() + 60_000);
            return { message: "LRCLIB rate limited; retry later (Retry-After is honoured)." };
          }
          if (response.status === 404) {
            if (misses.size >= CACHE_LIMIT) misses.delete(misses.keys().next().value!);
            misses.set(key, now() + 10 * 60_000);
            return { message: "Lyrics unavailable for this exact recording." };
          }
          return { message: "Lyrics provider unavailable. Local/cached lyrics still work." };
        }
        const record = JSON.parse(await responseText(response)); signal.throwIfAborted();
        if (typeof record.trackName !== "string" || typeof record.artistName !== "string" || norm(record.trackName) !== norm(signature.title) || norm(record.artistName) !== norm(signature.artist) ||
          (signature.duration && (!Number.isFinite(record.duration) || Math.abs(record.duration - signature.duration) > 2)))
          return { message: "Lyrics unavailable: provider returned a different recording." };
        const item: Cached = { key, savedAt: now(), plainLyrics: record.plainLyrics ?? "", syncedLyrics: record.syncedLyrics ?? "", instrumental: record.instrumental === true };
        if (!validCache(item)) return { message: "Lyrics response was invalid or too large." };
        const lyrics = decoded(item, "LRCLIB");
        if (!lyrics.instrumental && !lyrics.lines.length && !lyrics.plain.length) return { message: "Lyrics unavailable for this recording." };
        const entries = [item, ...(await readCache()).filter(c => c.key !== key)].slice(0, CACHE_LIMIT);
        signal.throwIfAborted();
        let message = "";
        try {
          await fs.mkdir(path.dirname(cacheFile), { recursive: true });
          const tmp = `${cacheFile}.${process.pid}.tmp`;
          await fs.writeFile(tmp, JSON.stringify({ version: 1, entries }), { mode: 0o600 });
          await fs.rename(tmp, cacheFile);
        } catch { message = "Lyrics loaded; could not save offline cache."; }
        return { lyrics, message };
      } catch (e) {
        signal.throwIfAborted();
        return { message: "Lyrics lookup failed or timed out. Local/cached lyrics still work." };
      } finally { nextRequest = now() + spacing; }
    });
    tail = job; return job;
  };
}
export const loadLyrics = createLyricsService();
