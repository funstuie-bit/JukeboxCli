import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { paths } from "../config/paths";
import type { MusicFilter, MusicPage, MusicResult } from "./music";

export const searchHistoryFile = path.join(paths.data, "search-history.json");
const MAX_BYTES = 1024 * 1024;
const kinds: MusicFilter[] = ["song", "video", "album", "artist", "playlist"];
export interface SavedSearch { query: string; kind: MusicFilter }
interface SavedResults extends SavedSearch { page: MusicPage; cursor: number }
interface Catalogue { recent: SavedSearch[]; last?: SavedResults }
const text = (value: unknown, max = 500): value is string => typeof value === "string" && value.length <= max;
const queryText = (value: string) => value.trim().slice(0, 500);

/** Persist provider metadata only: never parser objects, continuation closures or resolved media URLs. */
function result(value: any): MusicResult | null {
  if (!value || !text(value.id, 200) || !kinds.includes(value.kind) || !text(value.title) ||
      (value.subtitle !== undefined && !text(value.subtitle, 1000))) return null;
  const item: MusicResult = { id: value.id, kind: value.kind, title: value.title, subtitle: value.subtitle };
  const t = value.track;
  if (t?.source === "youtube" && text(t.sourceTrackId, 11) && /^[\w-]{11}$/.test(t.sourceTrackId)) {
    const id = t.sourceTrackId;
    item.track = { kind: "stream", id: `stream:youtube:${id}`, source: "youtube", sourceTrackId: id,
      title: item.title, artist: text(t.artist) ? t.artist : undefined,
      album: text(t.album) ? t.album : undefined,
      streamUrl: `https://www.youtube.com/watch?v=${id}`,
      thumbnailUrl: thumbnail(t.thumbnailUrl),
      durationSec: Number.isFinite(t.durationSec) && t.durationSec >= 0 ? t.durationSec : undefined,
      isLive: t.isLive === true, addedAt: text(t.addedAt, 50) ? t.addedAt : "" };
  }
  // A malformed playable row must not become an unplayable collection.
  return (item.kind === "song" || item.kind === "video") && !item.track ? null : item;
}
function thumbnail(value: unknown): string | undefined {
  if (!text(value, 2000)) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password &&
        /(^|\.)(ytimg\.com|ggpht\.com|googleusercontent\.com)$/.test(url.hostname)) return url.href;
  } catch { /* Missing or invalid artwork is optional. */ }
}
function savedSearch(value: any): value is SavedSearch {
  return !!value && text(value.query) && !!value.query.trim() && kinds.includes(value.kind);
}

/** Two independent catalogues, each with 30 searches and at most 100 cached results. */
export class SearchHistory {
  private catalogues: Record<"music" | "videos", Catalogue> = { music: { recent: [] }, videos: { recent: [] } };
  error: string | null = null;
  constructor(private file = searchHistoryFile) {
    try {
      if (statSync(file).size > MAX_BYTES) return;
      const data = JSON.parse(readFileSync(file, "utf8"));
      if (data.version !== 1) return;
      for (const key of ["music", "videos"] as const) {
        const source = data[key];
        if (!source || !Array.isArray(source.recent)) continue;
        const recent = source.recent.slice(0, 30).filter(savedSearch).map((s: SavedSearch) => ({ query: queryText(s.query), kind: s.kind }));
        const last: SavedResults | undefined = source.last;
        this.catalogues[key] = { recent };
        if (savedSearch(last) && last.page && text(last.page.title) && Array.isArray(last.page.items)) {
          const items = last.page.items.slice(0, 100).map(result).filter((i: MusicResult | null): i is MusicResult => i !== null);
          this.catalogues[key].last = { query: queryText(last.query), kind: last.kind, page: { title: last.page.title, items },
            cursor: Number.isInteger(last.cursor) ? Math.max(0, Math.min(last.cursor, items.length - 1)) : 0 };
        }
      }
    } catch { /* First launch or damaged history starts empty; playback is unaffected. */ }
  }
  recent(videos: boolean): SavedSearch[] { return this.catalogues[videos ? "videos" : "music"].recent.slice(); }
  last(videos: boolean): SavedResults | undefined { return this.catalogues[videos ? "videos" : "music"].last; }
  record(videos: boolean, query: string, kind: MusicFilter, page: MusicPage): void {
    query = queryText(query); if (!query) return;
    const catalogue = this.catalogues[videos ? "videos" : "music"];
    catalogue.recent = [{ query, kind }, ...catalogue.recent.filter(s => s.query !== query || s.kind !== kind)].slice(0, 30);
    catalogue.last = { query, kind, cursor: 0, page: { title: page.title.slice(0, 500),
      items: page.items.slice(0, 100).map(result).filter((i): i is MusicResult => i !== null) } };
    this.flush();
  }
  rememberCursor(videos: boolean, query: string, kind: MusicFilter, cursor: number): void {
    const last = this.last(videos);
    if (last?.query === query.trim() && last.kind === kind) {
      const next = Math.max(0, Math.min(cursor, last.page.items.length - 1));
      if (next !== last.cursor) { last.cursor = next; this.flush(); }
    }
  }
  clear(videos: boolean): void { this.catalogues[videos ? "videos" : "music"] = { recent: [] }; this.flush(); }
  private flush(): void {
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      let data = JSON.stringify({ version: 1, ...this.catalogues });
      // Long Unicode metadata can exceed the byte limit despite the row cap.
      // Keep recent queries and trim cached rows until our own file is readable.
      while (Buffer.byteLength(data) > MAX_BYTES) {
        for (const { last } of Object.values(this.catalogues)) {
          if (!last) continue;
          last.page = { ...last.page, items: last.page.items.slice(0, Math.floor(last.page.items.length / 2)) };
          last.cursor = Math.max(0, Math.min(last.cursor, last.page.items.length - 1));
        }
        data = JSON.stringify({ version: 1, ...this.catalogues });
      }
      writeFileSync(tmp, data, { mode: 0o600 });
      renameSync(tmp, this.file); this.error = null;
    } catch { this.error = "Could not save searches on this device"; }
  }
}

const histories = new WeakMap<object, SearchHistory>();
export function searchHistoryFor(owner: object): SearchHistory {
  let history = histories.get(owner);
  if (!history) { history = new SearchHistory(); histories.set(owner, history); }
  return history;
}
