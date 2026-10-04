import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { isHttpUrl, isStream, type PlayableTrack } from "../player/media";
import { trackFromUrl } from "../player/url";
import type { Track } from "./types";

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TRACKS = 10000;
type Entry = { kind: "local"; path: string; title: string } |
  { kind: "stream"; url: string; title: string; artist?: string; type: "radio" | "direct" | "extractor" };
export interface PlaylistPreview { tracks: PlayableTrack[]; missing: number; invalid: number; total: number }
const text = (value: unknown): string => typeof value === "string" ? value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 1000) : "";
function relativeAudio(value: string): boolean {
  return !!value && value === value.trim() && !value.startsWith("#") && !value.includes("\\") && !path.posix.isAbsolute(value) && !value.split("/").includes("..") && !/^[a-z][a-z\d+.-]*:/i.test(value) && !/[\x00-\x1f\x7f]/.test(value);
}

/** Local entries are rooted at the configured music folder, never the exporter home. */
export function encodePlaylist(tracks: readonly PlayableTrack[], root: string, format: "json" | "m3u"): { content: string; omitted: number } {
  if (tracks.length > MAX_TRACKS) throw new Error("Maximum 10,000 playlist entries");
  const entries: Entry[] = [];
  let omitted = 0;
  for (const t of tracks) {
    if (isStream(t)) {
      if (!isHttpUrl(t.streamUrl)) { omitted++; continue; }
      entries.push({ kind: "stream", url: t.streamUrl, title: text(t.title), artist: text(t.artist) || undefined, type: t.streamType ?? "extractor" });
    } else {
      const relative = path.relative(root, t.filePath).split(path.sep).join("/");
      if (!relativeAudio(relative)) { omitted++; continue; }
      entries.push({ kind: "local", path: relative, title: text(t.title) });
    }
  }
  const content = format === "json" ? JSON.stringify({ format: "jukeboxcli-playlist", version: 1, entries }, null, 2) + "\n"
    : "#EXTM3U\n#JUKEBOXCLI-ROOT:music\n" + entries.map(e => `#EXTINF:-1,${e.title}\n${e.kind === "stream" ? `#JUKEBOXCLI-TYPE:${e.type}\n${e.url}` : e.path}\n`).join("");
  if (Buffer.byteLength(content) > MAX_BYTES) throw new Error("Playlist exceeds 2 MB");
  return { content, omitted };
}

export function decodePlaylist(raw: string, tracks: readonly Track[], root: string): PlaylistPreview {
  if (Buffer.byteLength(raw) > MAX_BYTES) throw new Error("Playlist exceeds 2 MB");
  const input = raw.replace(/^\uFEFF/, "").trim();
  let entries: unknown[];
  if (input.startsWith("{")) {
    const data = JSON.parse(input);
    if (data.format !== "jukeboxcli-playlist" || data.version !== 1 || !Array.isArray(data.entries)) throw new Error("Unsupported playlist format/version");
    entries = data.entries;
  } else {
    if (!input.startsWith("#EXTM3U")) throw new Error("Choose a JukeboxCli JSON or extended M3U playlist");
    entries = [];
    let title = "", type = "";
    for (const rawLine of input.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith("#EXTINF:")) { title = line.slice(line.indexOf(",") + 1); continue; }
      if (line.startsWith("#JUKEBOXCLI-TYPE:")) { type = line.slice(17); continue; }
      if (!line || line.startsWith("#")) continue;
      entries.push(isHttpUrl(line) ? { kind: "stream", url: line, title, type: type || undefined } : { kind: "local", path: line, title });
      if (entries.length > MAX_TRACKS) throw new Error("Maximum 10,000 playlist entries");
      title = ""; type = "";
    }
  }
  if (entries.length > MAX_TRACKS) throw new Error("Maximum 10,000 playlist entries");
  const byPath = new Map(tracks.map(t => [path.resolve(t.filePath), t]));
  const result: PlaylistPreview = { tracks: [], missing: 0, invalid: 0, total: entries.length };
  for (const rawEntry of entries) {
    if (!rawEntry || typeof rawEntry !== "object") { result.invalid++; continue; }
    const e = rawEntry as Record<string, unknown>;
    if (e.kind === "local" && typeof e.path === "string" && relativeAudio(e.path)) {
      const track = byPath.get(path.resolve(root, e.path));
      if (track) result.tracks.push(track); else result.missing++;
    } else if (e.kind === "stream" && isHttpUrl(e.url) && (e.type === undefined || ["radio", "direct", "extractor"].includes(String(e.type)))) {
      try {
        const track = trackFromUrl(e.url, e.type === "radio");
        result.tracks.push({ ...track, title: text(e.title) || track.title, artist: text(e.artist) || undefined,
          streamType: e.type as "radio" | "direct" | "extractor" | undefined ?? track.streamType });
      } catch { result.invalid++; }
    } else result.invalid++;
  }
  return result;
}

export async function readPlaylist(file: string, tracks: readonly Track[], root: string): Promise<PlaylistPreview> {
  const handle = await fs.open(file, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error("Choose a regular playlist file smaller than 2 MB");
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const result = decodePlaylist(buffer.subarray(0, bytesRead).toString("utf8"), tracks, root);
    const available: PlayableTrack[] = [];
    for (const track of result.tracks) {
      if (isStream(track) || await fs.stat(track.filePath).then(s => s.isFile()).catch(() => false)) available.push(track);
      else result.missing++;
    }
    return { ...result, tracks: available };
  } finally { await handle.close(); }
}

export async function writePlaylist(file: string, tracks: readonly PlayableTrack[], root: string): Promise<number> {
  const ext = path.extname(file).toLowerCase();
  if (![".json", ".m3u", ".m3u8"].includes(ext)) throw new Error("Use a .json, .m3u or .m3u8 filename");
  const { content, omitted } = encodePlaylist(tracks, root, ext === ".json" ? "json" : "m3u");
  await fs.writeFile(file, content, { flag: "wx", mode: 0o600 });
  return omitted;
}
