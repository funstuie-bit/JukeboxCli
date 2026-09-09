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
export interface LyricWord { at: number; text: string }
export interface LyricLine { at: number; text: string; words?: LyricWord[] }
export interface Lyrics {
  lines: LyricLine[];
  plain: string[];
  instrumental?: boolean;
  source: "Local LRC" | "Cache · LRCLIB" | "LRCLIB" | "lyrics.ovh" | "Cache · lyrics.ovh";
  match?: string;
  plainOnly?: boolean;
}
export interface LyricsCandidate {
  id: number; title: string; artist: string; album: string; duration: number;
  plainLyrics: string; syncedLyrics: string; instrumental: boolean;
}
export interface LyricsResult { lyrics?: Lyrics; message: string; candidates?: LyricsCandidate[] }
export interface LyricsOptions {
  signal: AbortSignal; online: boolean; broadcast?: string; retry?: boolean;
  query?: string; candidate?: LyricsCandidate; alternate?: { artist: string; title: string };
}
interface Signature { title: string; artist: string; album?: string; duration?: number }
interface Cached { key: string; savedAt: number; plainLyrics: string; syncedLyrics: string; instrumental: boolean;
  provider?: "lyrics.ovh"; match?: string; plainOnly?: boolean; manual?: boolean }
const lyricText = (value: string) => {
  const stripped = stripVTControlCharacters(value).replace(/[\x00-\x1f\x7f-\x9f]/g, "").trim();
  return stripped ? cleanText(stripped) : "";
};

/** Enhanced LRC uses supplied word timestamps only; never estimated karaoke timing. */
export function parseLrc(raw: string): Pick<Lyrics, "lines" | "plain"> {
  if (Buffer.byteLength(raw) > TEXT_LIMIT) throw Error("Lyrics file is too large (64 KiB maximum).");
  const rows = raw.replace(/^\uFEFF/, "").split(/\r?\n/).slice(0, 2048);
  const offset = Number([...raw.matchAll(/\[offset:([+-]?\d+)\]/gi)].at(-1)?.[1] ?? 0) / 1000;
  const lines: LyricLine[] = []; const plain: string[] = [];
  for (const row of rows) {
    const times = [...row.matchAll(/\[(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?\]/g)];
    const marks = [...row.matchAll(/<(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?>/g)];
    const words = marks.map((m, i) => ({
      at: Math.max(0, Math.round((Number(m[1]) * 60 + Number(m[2]) + Number(`0.${m[3] ?? "0"}`) + offset) * 1000) / 1000),
      text: lyricText(row.slice(m.index! + m[0].length, marks[i + 1]?.index)),
    })).filter(word => word.text);
    const text = lyricText(row.replace(/\[(?:\d{1,3}:[0-5]\d(?:\.\d{1,3})?|[a-z]+:[^\]]*)\]/gi, "")
      .replace(/<\d{1,3}:[0-5]\d(?:\.\d{1,3})?>/g, "")).trim();
    if (text) plain.push(text);
    for (const match of times) {
      if (lines.length >= 4096) break;
      const at = Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] ?? "0"}`) + offset;
      // Multiple line stamps have ambiguous word offsets; fall back to line timing.
      const validWords = times.length === 1 && words.length > 1 && words[0]!.at >= at &&
        words.every((w, i) => !i || w.at >= words[i - 1]!.at) && words.map(w => w.text).join(" ") === text;
      if (Number.isFinite(at)) lines.push({ at: Math.max(0, Math.round(at * 1000) / 1000), text, ...(validWords ? { words } : {}) });
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

/** Remove mastering labels only, not live/remix/edit/acoustic/version distinctions. */
export function lyricTitle(title: string): string {
  return title.replace(/\s*[([](?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?[)\]]/gi, "")
    .replace(/\s+[-–—]\s+(?:\d{4}\s+)?remaster(?:ed)?(?:\s+\d{4})?$/i, "").trim();
}
export function safeLyricMatch(s: Signature, c: LyricsCandidate): boolean {
  const artist = norm(s.artist), primary = norm(s.artist.split(/,\s+|\s+feat\.?\s+/i)[0]!);
  return !!s.duration && Math.abs(s.duration - c.duration) <= 2 &&
    norm(lyricTitle(s.title)) === norm(lyricTitle(c.title)) &&
    (norm(c.artist) === artist || norm(c.artist) === primary);
}
function candidate(raw: unknown): LyricsCandidate | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || !Number.isSafeInteger(r.id) || Number(r.id) < 0 || typeof r.trackName !== "string" || typeof r.artistName !== "string" ||
      typeof r.duration !== "number" || !Number.isFinite(r.duration) || r.duration < 0 || r.duration > 86400) return null;
  const plainLyrics = r.plainLyrics ?? "", syncedLyrics = r.syncedLyrics ?? "";
  if (typeof plainLyrics !== "string" || typeof syncedLyrics !== "string" || Buffer.byteLength(plainLyrics) + Buffer.byteLength(syncedLyrics) > TEXT_LIMIT) return null;
  if (!plainLyrics && !syncedLyrics && r.instrumental !== true) return null;
  return { id: Number(r.id), title: lyricText(r.trackName).slice(0, 200), artist: lyricText(r.artistName).slice(0, 200),
    album: typeof r.albumName === "string" ? lyricText(r.albumName).slice(0, 200) : "", duration: r.duration,
    plainLyrics, syncedLyrics, instrumental: r.instrumental === true };
}

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
    Buffer.byteLength(c.plainLyrics) + Buffer.byteLength(c.syncedLyrics) <= TEXT_LIMIT &&
    (c.provider === undefined || c.provider === "lyrics.ovh") &&
    (c.match === undefined || typeof c.match === "string" && c.match.length <= 450) &&
    (c.plainOnly === undefined || typeof c.plainOnly === "boolean") &&
    (c.manual === undefined || typeof c.manual === "boolean");
}
function decoded(c: Cached, source: Lyrics["source"]): Lyrics {
  const timed = parseLrc(c.syncedLyrics);
  return { lines: timed.lines, plain: c.plainLyrics ? parseLrc(c.plainLyrics).plain : timed.plain, instrumental: c.instrumental, source,
    match: c.match ? lyricText(c.match) : undefined, plainOnly: c.plainOnly };
}
async function responseText(response: Response, limit = 256 * 1024): Promise<string> {
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
  let tail: Promise<unknown> = Promise.resolve(), nextRequest = 0;
  const blocked = new Map<string, number>();
  const misses = new Map<string, number>();
  const readCache = async (): Promise<Cached[]> => {
    try {
      const data = JSON.parse(await readBounded(cacheFile, 5 * 1024 * 1024));
      return data.version === 1 && Array.isArray(data.entries) ? data.entries.slice(0, CACHE_LIMIT).filter(validCache) : [];
    } catch { return []; }
  };
  const request = async (url: URL, signal: AbortSignal, search = false): Promise<unknown> => {
    if ((blocked.get(url.origin) ?? 0) > now()) throw Error("Provider rate limited; retry later (Retry-After is honoured).");
    if (nextRequest > now()) await delay(nextRequest - now(), undefined, { signal });
    signal.throwIfAborted();
    try {
      const response = await fetcher(url.href, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), redirect: "error", credentials: "omit",
        headers: { "User-Agent": "JukeboxCli/0.1.0-dev.10 (https://github.com/funstuie-bit/JukeboxCli)", Accept: "application/json" } });
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429) {
          const retry = response.headers.get("retry-after") ?? "60", seconds = Number(retry);
          blocked.set(url.origin, Math.max(now() + 1000, Number.isFinite(seconds) ? now() + seconds * 1000 : Date.parse(retry) || now() + 60_000));
          throw Error("Provider rate limited; retry later (Retry-After is honoured).");
        }
        if (response.status === 404) return null;
        throw Error("Lyrics provider unavailable. Local/cached lyrics still work.");
      }
      const data: unknown = JSON.parse(await responseText(response, search ? 2 * 1024 * 1024 : 256 * 1024));
      signal.throwIfAborted(); return data;
    } finally { nextRequest = now() + spacing; }
  };
  return async (track: PlayableTrack, options: LyricsOptions): Promise<LyricsResult> => {
    const { signal, online, broadcast, retry, query, candidate: chosen, alternate } = options;
    signal.throwIfAborted();
    const signature = lyricsSignature(track, broadcast);
    // Manual choices can be remembered even for tracks without complete tags.
    const key = signature ? keyFor(signature) : createHash("sha256").update(JSON.stringify([track.id, track.title, broadcast])).digest("hex");
    const action = query !== undefined || !!chosen || !!alternate;
    const cached = (await readCache()).find(c => c.key === key); signal.throwIfAborted();
    const fromCache = (c: Cached): LyricsResult => ({ lyrics: decoded(c, c.provider ? "Cache · lyrics.ovh" : "Cache · LRCLIB"), message: "" });
    if (!action && !retry && cached?.manual) return fromCache(cached);
    if (!action && !retry && !isStream(track)) {
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
    if (!action && !retry && cached) return fromCache(cached);
    if (!online && !chosen) return { message: "Online lyrics disabled — Shift+L to enable. No local/cached lyrics. Sends artist/title, optional album and duration to LRCLIB." };
    if (!action && !signature) return { message: isLive(track) ? "Waiting for a clear Artist - Song broadcast title; DJ mixes are skipped." : "Artist/title missing — / searches manually." };
    const job = tail.catch(() => {}).then(async (): Promise<LyricsResult> => {
      signal.throwIfAborted();
      const save = async (item: Cached): Promise<LyricsResult> => {
        if (!validCache(item)) return { message: "Lyrics response was invalid or too large." };
        const lyrics = decoded(item, item.provider ?? "LRCLIB");
        if (!lyrics.instrumental && !lyrics.lines.length && !lyrics.plain.length) return { message: "Lyrics unavailable for this recording." };
        const entries = [item, ...(await readCache()).filter(c => c.key !== key)].slice(0, CACHE_LIMIT);
        signal.throwIfAborted();
        let json = JSON.stringify({ version: 1, entries });
        while (Buffer.byteLength(json) > 5 * 1024 * 1024 && entries.length > 1) {
          entries.pop(); json = JSON.stringify({ version: 1, entries });
        }
        let message = "";
        try {
          await fs.mkdir(path.dirname(cacheFile), { recursive: true });
          const tmp = `${cacheFile}.${process.pid}.tmp`;
          await fs.writeFile(tmp, json, { mode: 0o600 }); await fs.rename(tmp, cacheFile);
        } catch { message = "Lyrics loaded; could not save offline cache."; }
        misses.delete(key); return { lyrics, message };
      };
      const saveCandidate = (c: LyricsCandidate, manual: boolean) => save({ key, savedAt: now(), plainLyrics: c.plainLyrics,
        syncedLyrics: c.syncedLyrics, instrumental: c.instrumental, match: `${c.artist} — ${c.title}`, manual,
        // Explicitly selected other recordings remain usable as plain text, not falsely synced.
        plainOnly: manual && (!signature || !safeLyricMatch(signature, c)) });
      const search = async (term: string): Promise<LyricsCandidate[]> => {
        const url = new URL("https://lrclib.net/api/search");
        url.searchParams.set("q", lyricText(term).slice(0, 200));
        const raw = await request(url, signal, true);
        if (!Array.isArray(raw)) return [];
        const seen = new Set<number>();
        return raw.slice(0, 20).map(candidate).filter((c): c is LyricsCandidate => {
          if (!c || seen.has(c.id)) return false; seen.add(c.id); return true;
        });
      };
      try {
        if (chosen) {
          const valid = candidate({ id: chosen.id, trackName: chosen.title, artistName: chosen.artist, albumName: chosen.album,
            duration: chosen.duration, plainLyrics: chosen.plainLyrics, syncedLyrics: chosen.syncedLyrics, instrumental: chosen.instrumental });
          return valid ? await saveCandidate(valid, true) : { message: "Invalid lyrics selection." };
        }
        if (alternate) {
          const artist = lyricText(alternate.artist).slice(0, 200), title = lyricText(alternate.title).slice(0, 200);
          if (!artist || !title) return { message: "Enter Artist - Song for lyrics.ovh." };
          const url = new URL(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
          const raw = await request(url, signal) as { lyrics?: unknown } | null;
          if (!raw || typeof raw.lyrics !== "string") return { message: "lyrics.ovh: lyrics unavailable. / searches LRCLIB." };
          return await save({ key, savedAt: now(), plainLyrics: raw.lyrics, syncedLyrics: "", instrumental: false,
            provider: "lyrics.ovh", match: `${artist} — ${title} (unverified)`, plainOnly: true, manual: true });
        }
        if (query !== undefined) {
          if (!lyricText(query)) return { message: "Enter a song or artist to search.", candidates: [] };
          const candidates = await search(query);
          return { candidates, message: candidates.length ? "Choose a recording · mismatched versions use plain lyrics" : "No results — / change search or O try lyrics.ovh." };
        }
        const previous = (await readCache()).find(c => c.key === key); signal.throwIfAborted();
        if (previous && !retry) return fromCache(previous);
        if (!retry && (misses.get(key) ?? 0) > now()) return { message: "Lyrics unavailable. / manual search · R retry." };
        const s = signature!;
        const url = new URL("https://lrclib.net/api/get");
        url.searchParams.set("track_name", s.title); url.searchParams.set("artist_name", s.artist);
        if (s.album) url.searchParams.set("album_name", s.album);
        if (s.duration) url.searchParams.set("duration", String(s.duration));
        const record = await request(url, signal) as Record<string, unknown> | null;
        const exact = record && typeof record.trackName === "string" && typeof record.artistName === "string" &&
          norm(record.trackName) === norm(s.title) && norm(record.artistName) === norm(s.artist) &&
          (!s.duration || typeof record.duration === "number" && Math.abs(record.duration - s.duration) <= 2);
        if (exact) return await save({ key, savedAt: now(), plainLyrics: (record.plainLyrics ?? "") as string,
          syncedLyrics: (record.syncedLyrics ?? "") as string, instrumental: record.instrumental === true });
        // Never guess a different radio song or normalise a station/DJ title.
        if (isLive(track)) return { message: "No exact radio-song lyrics. / searches manually." };
        const title = lyricTitle(s.title), artist = s.artist.split(/,\s+|\s+feat\.?\s+/i)[0]!;
        // Ask the provider to resolve the normalised recording with duration before
        // broad search. Missing duration never authorises an automatic fallback.
        if (s.duration && (title !== s.title || artist !== s.artist || s.album)) {
          const relaxed = new URL("https://lrclib.net/api/get");
          relaxed.searchParams.set("track_name", title); relaxed.searchParams.set("artist_name", artist);
          relaxed.searchParams.set("duration", String(s.duration));
          const found = candidate(await request(relaxed, signal));
          if (found && safeLyricMatch(s, found)) return await saveCandidate(found, false);
        }
        const candidates = await search(`${title} ${artist}`);
        candidates.sort((a, b) => Number(safeLyricMatch(s, b)) - Number(safeLyricMatch(s, a)) ||
          (s.duration ? Math.abs(a.duration - s.duration) - Math.abs(b.duration - s.duration) : 0));
        const safe = candidates.filter(c => safeLyricMatch(s, c));
        if (safe.length === 1) return await saveCandidate(safe[0]!, false);
        if (candidates.length) return { candidates, message: "No unique recording match — choose lyrics, or / refine search." };
        if (misses.size >= CACHE_LIMIT) misses.delete(misses.keys().next().value!);
        misses.set(key, now() + 10 * 60_000);
        return { message: "Lyrics unavailable for this recording. / search · O other provider · R retry." };
      } catch (e) {
        signal.throwIfAborted();
        return { message: e instanceof Error && /rate limited|provider unavailable/.test(e.message) ? e.message : "Lyrics lookup failed or timed out. / search · R retry. Local/cached lyrics still work." };
      }
    });
    tail = job; return job;
  };
}
export const loadLyrics = createLyricsService();
