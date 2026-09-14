import { isHttpUrl, type StreamTrack } from "./media";
import { trackFromUrl } from "./url";
import { cleanText } from "../util/format";

const API = "https://all.api.radio-browser.info/json";
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_RESULTS = 75;
type Fetcher = typeof fetch;

interface DirectoryStation {
  stationuuid?: unknown;
  name?: unknown;
  url?: unknown;
  url_resolved?: unknown;
  homepage?: unknown;
  favicon?: unknown;
  country?: unknown;
  countrycode?: unknown;
  tags?: unknown;
  codec?: unknown;
  bitrate?: unknown;
  lastcheckok?: unknown;
}

export interface RadioDirectoryResult { tracks: StreamTrack[]; note: string }
export interface RadioFacet { name: string; query: string; count: number }
export type RadioFacetKind = "tags" | "countries";
/** Small first-party shortcuts into Radio Browser; no third-party hosted feeds. */
export const QUICK_RADIO_CHANNELS: readonly RadioFacet[] = [
  { name: "Lo-fi", query: "tag:lofi", count: 0 },
  { name: "Synthwave", query: "tag:synthwave", count: 0 },
  { name: "Ambient", query: "tag:ambient", count: 0 },
  { name: "Chillout", query: "tag:chillout", count: 0 },
  { name: "Jazz", query: "tag:jazz", count: 0 },
  { name: "Classical", query: "tag:classical", count: 0 },
  { name: "House", query: "tag:house", count: 0 },
  { name: "Drum & Bass", query: "tag:drum and bass", count: 0 },
  { name: "Reggae", query: "tag:reggae", count: 0 },
  { name: "Rock", query: "tag:rock", count: 0 },
];

function queryUrl(input: string, api: string): URL {
  // Blank is meaningful: it requests the most-clicked working stations.
  // cleanText's display fallback is "Untitled", so only apply it to text.
  const raw = input.trim();
  const query = raw ? cleanText(raw).trim() : "";
  if (query.length > 120) throw Error("Keep radio searches under 120 characters.");
  const url = new URL(`${api.replace(/\/$/, "")}/stations/search`);
  url.searchParams.set("hidebroken", "true");
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("order", "clickcount");
  url.searchParams.set("reverse", "true");
  if (!query) return url;
  const prefix = /^(tag|country)\s*:\s*(.+)$/i.exec(query);
  if (!prefix) url.searchParams.set("name", query);
  else if (prefix[1]!.toLowerCase() === "tag") {
    url.searchParams.set("tag", prefix[2]!.trim());
    url.searchParams.set("tagExact", "true");
  } else if (/^[a-z]{2}$/i.test(prefix[2]!.trim())) {
    url.searchParams.set("countrycode", prefix[2]!.trim().toUpperCase());
  } else {
    url.searchParams.set("country", prefix[2]!.trim());
    url.searchParams.set("countryExact", "true");
  }
  return url;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw Error("The radio directory response was too large.");
  }
  const reader = response.body?.getReader();
  if (!reader) return [];
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw Error("The radio directory response was too large.");
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("too large")) throw error;
    throw Error("The radio directory returned an unreadable response.");
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";
  return cleanText(value).trim();
}

function stationTrack(row: DirectoryStation): StreamTrack | undefined {
  if ([0, "0", false].includes(row.lastcheckok as never)) return;
  const name = text(row.name).slice(0, 120);
  const streamUrl = text(row.url_resolved) || text(row.url);
  if (!name || !isHttpUrl(streamUrl)) return;
  try {
    const track = trackFromUrl(streamUrl, true);
    track.title = name;
    const country = text(row.country) || text(row.countrycode).toUpperCase();
    const codec = text(row.codec).toUpperCase();
    const bitrate = typeof row.bitrate === "number" && row.bitrate > 0 && row.bitrate < 10000 ? `${Math.round(row.bitrate)} kbps` : "";
    track.artist = [country, codec, bitrate].filter(Boolean).join(" · ") || undefined;
    const tags = text(row.tags).split(",").map(tag => tag.trim()).filter(Boolean).slice(0, 4).join(" · ");
    track.album = tags || undefined;
    const homepage = text(row.homepage); const favicon = text(row.favicon);
    if (isHttpUrl(homepage)) track.stationWebsite = homepage;
    if (isHttpUrl(favicon)) track.thumbnailUrl = favicon;
    return track;
  } catch { return; }
}

/** Search the community Radio Browser catalogue without cookies or account data. */
export async function searchRadioDirectory(input: string, signal: AbortSignal, fetcher: Fetcher = fetch, api = API): Promise<RadioDirectoryResult> {
  signal.throwIfAborted();
  const combined = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  try {
    const response = await fetcher(queryUrl(input, api), { signal: combined, credentials: "omit",
      headers: { Accept: "application/json", "User-Agent": "JukeboxCli/0.1 radio-directory" } });
    if (!response.ok) { await response.body?.cancel(); throw Error("The radio directory is unavailable right now."); }
    const value = await boundedJson(response);
    if (!Array.isArray(value)) throw Error("The radio directory returned an unreadable response.");
    const found = new Map<string, StreamTrack>();
    for (const row of value) {
      if (!row || typeof row !== "object") continue;
      const track = stationTrack(row as DirectoryStation);
      if (track && !found.has(track.streamUrl)) found.set(track.streamUrl, track);
    }
    const tracks = [...found.values()].slice(0, MAX_RESULTS);
    return { tracks, note: tracks.length
      ? `Found ${tracks.length} station${tracks.length === 1 ? "" : "s"} in Radio Browser · play, queue or save`
      : "No working stations matched. Try a broader name, tag or country." };
  } catch (error) {
    signal.throwIfAborted();
    if (combined.aborted) throw Error("The radio directory timed out. Check your connection and try again.");
    if (error instanceof Error && /^(The radio directory|Keep radio)/.test(error.message)) throw error;
    throw Error("Could not search the radio directory. Check your connection and try again.");
  }
}

/** Load browsable directory filters; selecting one still uses the bounded station search above. */
export async function listRadioFacets(kind: RadioFacetKind, signal: AbortSignal, fetcher: Fetcher = fetch, api = API): Promise<RadioFacet[]> {
  signal.throwIfAborted();
  const combined = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
  const url = new URL(`${api.replace(/\/$/, "")}/${kind}`);
  url.searchParams.set("hidebroken", "true");
  url.searchParams.set("limit", kind === "tags" ? "300" : "250");
  url.searchParams.set("order", "stationcount");
  url.searchParams.set("reverse", "true");
  try {
    const response = await fetcher(url, { signal: combined, credentials: "omit",
      headers: { Accept: "application/json", "User-Agent": "JukeboxCli/0.1 radio-directory" } });
    if (!response.ok) { await response.body?.cancel(); throw Error("The radio directory is unavailable right now."); }
    const value = await boundedJson(response);
    if (!Array.isArray(value)) throw Error("The radio directory returned an unreadable response.");
    const found = new Map<string, RadioFacet>();
    for (const raw of value) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const name = text(row.name).slice(0, 80);
      const count = typeof row.stationcount === "number" && row.stationcount > 0 ? Math.round(row.stationcount) : 0;
      const code = text(row.iso_3166_1).toUpperCase();
      const query = kind === "tags" ? `tag:${name}` : /^[A-Z]{2}$/.test(code) ? `country:${code}` : `country:${name}`;
      if (name && count && !found.has(name.toLowerCase())) found.set(name.toLowerCase(), { name, query, count });
    }
    return [...found.values()];
  } catch (error) {
    signal.throwIfAborted();
    if (combined.aborted) throw Error("The radio directory timed out. Check your connection and try again.");
    if (error instanceof Error && error.message.startsWith("The radio directory")) throw error;
    throw Error("Could not browse the radio directory. Check your connection and try again.");
  }
}
