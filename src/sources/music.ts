import { isHttpUrl, type StreamTrack } from "../player/media";
import { AsyncLocalStorage } from "node:async_hooks";

// Per-request cancellation without a shared mutable signal across UI consumers.
const requestSignal = new AsyncLocalStorage<AbortSignal>();
function cancellable<T>(signal: AbortSignal | undefined, task: () => Promise<T>): Promise<T> {
  signal?.throwIfAborted();
  return signal ? requestSignal.run(signal, task) : task();
}

export type MusicFilter = "song" | "video" | "album" | "artist" | "playlist";
export interface MusicResult {
  id: string;
  kind: MusicFilter;
  title: string;
  subtitle?: string;
  track?: StreamTrack;
}
export interface MusicPage {
  title: string;
  items: MusicResult[];
  more?: (signal?: AbortSignal) => Promise<MusicPage>;
}

/** Thin data boundary, independent of YouTube.js parser classes in UI/tests. */
export function musicResult(raw: any, fallback: MusicFilter = "song"): MusicResult | null {
  if (!raw || typeof raw !== "object") return null;
  const kind = raw.item_type ?? fallback;
  if (!["song", "video", "album", "artist", "playlist"].includes(kind)) return null;
  const id = raw.id ?? raw.endpoint?.payload?.browseId ?? raw.endpoint?.payload?.videoId;
  const title = raw.title?.toString() ?? raw.name;
  if (typeof id !== "string" || !title || title === "[object Object]") return null;
  const artist = raw.artists?.map((a: any) => a.name).join(", ") ?? raw.author?.name;
  const result: MusicResult = { id, kind, title, subtitle: artist ?? raw.subtitle?.toString() };
  if (kind === "song" || kind === "video") {
    const candidates = raw.thumbnails ?? raw.thumbnail?.contents ?? [];
    const thumbnail = [...candidates].filter((t: any) => isHttpUrl(t.url))
      .sort((a: any, b: any) => (b.width ?? 0) * (b.height ?? 1) - (a.width ?? 0) * (a.height ?? 1))[0]?.url;
    result.track = { kind: "stream", id: `stream:youtube:${id}`, source: "youtube", sourceTrackId: id,
      title, artist, album: raw.album?.name, durationSec: raw.duration?.seconds,
      streamUrl: `https://music.youtube.com/watch?v=${encodeURIComponent(id)}`,
      thumbnailUrl: isHttpUrl(thumbnail) ? thumbnail : undefined, addedAt: new Date().toISOString() };
  }
  return result;
}

let client: Promise<import("youtubei.js").Innertube> | undefined;
async function musicClient() {
  client ??= (async () => {
    const { Innertube, Log } = await import("youtubei.js");
    Log.setLevel(Log.Level.ERROR);
    return Innertube.create({ retrieve_player: false, lang: "en", location: "US",
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.any([
        AbortSignal.timeout(20_000), ...(init?.signal ? [init.signal] : []),
        ...(requestSignal.getStore() ? [requestSignal.getStore()!] : []),
      ]) }) });
  })().catch(e => { client = undefined; throw e; });
  return (await client).music;
}
function rows(items: readonly unknown[] | undefined, kind: MusicFilter): MusicResult[] {
  return (items ?? []).map(item => musicResult(item, kind)).filter((x): x is MusicResult => x !== null);
}
export function searchPage(page: any, kind: MusicFilter, title: string): MusicPage {
  // First page is a shelf array; continuations wrap a single shelf.
  const contents = Array.isArray(page.contents) ? page.contents : page.contents ? [page.contents] : [];
  const items = contents.flatMap((shelf: any) => shelf.contents ?? [shelf]);
  return { title, items: rows(items, kind),
    more: page.has_continuation ? signal => cancellable(signal, async () => searchPage(await page.getContinuation(), kind, title)) : undefined };
}
export async function searchMusic(query: string, kind: MusicFilter, signal?: AbortSignal): Promise<MusicPage> {
  const clean = query.trim();
  if (!clean) return { title: "Search YouTube Music", items: [] };
  // Shared client setup is bounded independently; cancelling one search must
  // not cancel another consumer's client initialisation.
  const music = await musicClient();
  return cancellable(signal, async () => searchPage(await music.search(clean, { type: kind }), kind, clean));
}
function playlistPage(page: any, title: string): MusicPage {
  return { title, items: rows(page.items ?? page.contents, "song"),
    more: page.has_continuation ? async () => playlistPage(await page.getContinuation(), title) : undefined };
}
export async function browseMusic(item: MusicResult): Promise<MusicPage> {
  const music = await musicClient();
  if (item.kind === "album") return playlistPage(await music.getAlbum(item.id), item.title);
  if (item.kind === "playlist") return playlistPage(await music.getPlaylist(item.id), item.title);
  if (item.kind === "artist") {
    const artist = await music.getArtist(item.id);
    return { title: item.title, items: rows(artist.sections.flatMap(s => s.contents), "song") };
  }
  return { title: item.title, items: [item] };
}
