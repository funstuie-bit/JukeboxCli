import { trackFromUrl, playbackUrl } from "./url";
import type { StreamTrack } from "./media";
import { cleanText } from "../util/format";

const MAX_BYTES = 1024 * 1024;
const MAX_FEEDS = 12;
export interface FeedResult { tracks: StreamTrack[]; note: string }
type Fetcher = typeof fetch;

function entities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt);/gi, (raw, code: string) => {
    if (code[0] !== "#") return ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" } as Record<string, string>)[code.toLowerCase()] ?? raw;
    const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
}
function absolute(value: string | undefined, base: string): string | undefined {
  if (!value) return;
  try { return playbackUrl(new URL(entities(value).replace(/\\\//g, "/"), base).href).href; } catch { return; }
}
function attrs(tag: string): Record<string, string> {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(m => [m[1]!.toLowerCase(), entities(m[2] ?? m[3] ?? m[4] ?? "")]));
}
function named(url: string, name: string, website?: string, thumbnailUrl?: string): StreamTrack {
  return { ...trackFromUrl(url, true), title: cleanText(name).slice(0, 120), stationWebsite: website, thumbnailUrl };
}

/** Static HTML only: never execute scripts, follow arbitrary links or probe all candidates. */
export function feedsFromHtml(html: string, pageUrl: string): StreamTrack[] {
  const meta = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attrs(m[0]));
  const field = (key: string) => meta.find(a => (a.property ?? a.name)?.toLowerCase() === key)?.content;
  const name = field("og:site_name") || field("og:title") || entities(html.match(/<title[^>]*>([^<]*)/i)?.[1] || new URL(pageUrl).hostname);
  const image = absolute(field("og:image"), pageUrl);
  const found = new Map<string, StreamTrack>();
  const add = (value: string | undefined, label?: string) => {
    const url = absolute(value, pageUrl);
    if (!url || found.has(url) || found.size >= MAX_FEEDS) return;
    try { found.set(url, named(url, label ? `${name} · ${label}` : name, pageUrl, image)); } catch { /* unsupported playlist/page */ }
  };
  // Audio tags, common embedded player data, explicit downloadable audio links.
  for (const match of html.matchAll(/<(audio|source|a|div|span)\b[^>]*>/gi)) {
    const a = attrs(match[0]); const tag = match[1]!.toLowerCase();
    if (tag === "audio" || tag === "source") {
      if (!a.type || /^audio\//i.test(a.type) || /mpegurl/i.test(a.type)) add(a.src, a.title);
    }
    if (tag === "a" && a.href && /\.(mp3|aac|ogg|opus|m4a|m3u8)(?:[?#]|$)/i.test(a.href)) add(a.href, a.title);
    for (const key of ["data-flux", "data-flux-bd", "data-flux-hd", "data-stream", "data-stream-url"]) {
      add(a[key], key.endsWith("-hd") ? "HD" : key.endsWith("-bd") ? "Low bandwidth" : undefined);
    }
  }
  for (const match of html.matchAll(/["'](?:streamUrl|stream_url|stream|mp3|aac)["']\s*:\s*["']([^"']+)["']/gi)) add(match[1]);
  return [...found.values()];
}

/** PLS/M3U entry lists; HLS stays one feed, never expose its segments as stations. */
export function feedsFromPlaylist(text: string, url: string): StreamTrack[] {
  if (/#EXT-X-(?:TARGETDURATION|STREAM-INF|MEDIA-SEQUENCE)/i.test(text)) return [named(url, new URL(url).hostname)];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const entries: { url: string; name?: string }[] = [];
  if (/^\s*\[playlist\]/im.test(text)) {
    const titles = new Map(lines.flatMap(line => { const m = /^Title(\d+)=(.*)$/i.exec(line); return m ? [[m[1]!, m[2]!] as const] : []; }));
    for (const line of lines) { const m = /^File(\d+)=(.*)$/i.exec(line); if (m) entries.push({ url: m[2]!.trim(), name: titles.get(m[1]!) }); }
  } else {
    let title: string | undefined;
    for (const line of lines) {
      if (/^#EXTINF:/i.test(line)) title = line.slice(line.indexOf(",") + 1);
      else if (line.trim() && !line.startsWith("#")) { entries.push({ url: line.trim(), name: title }); title = undefined; }
    }
  }
  const found = new Map<string, StreamTrack>();
  for (const entry of entries) {
    // Reject explicit unsafe schemes; relative entries are resolved against the list.
    const link = absolute(entry.url, url);
    if (!link || found.has(link) || found.size >= MAX_FEEDS) continue;
    try { found.set(link, named(link, entry.name || new URL(link).hostname)); } catch { /* no nested playlists */ }
  }
  return [...found.values()];
}

async function request(url: string, signal: AbortSignal, fetcher: Fetcher): Promise<{ response: Response; url: string }> {
  for (let hop = 0; hop < 5; hop++) {
    signal.throwIfAborted();
    const response = await fetcher(playbackUrl(url).href, { signal, redirect: "manual", credentials: "omit",
      headers: { "User-Agent": "JukeboxCli/0.1 radio-feed-discovery", Accept: "text/html, audio/*, application/json, */*" } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = absolute(response.headers.get("location") ?? undefined, url);
      await response.body?.cancel();
      if (!next) throw Error("The station redirected to an unsupported link.");
      url = next; continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw Error("The site blocked detection or is unavailable. Try its direct audio URL."); }
    return { response, url };
  }
  throw Error("Too many station redirects. Try a direct audio URL.");
}
async function readText(response: Response): Promise<string> {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) { await response.body?.cancel(); throw Error("Station page is too large to inspect safely."); }
  const reader = response.body?.getReader(); if (!reader) return "";
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BYTES) throw Error("Station page is too large to inspect safely.");
      chunks.push(part.value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

// Explicit compatibility entries for the sites requested by the maintainer, verified
// 2026-09-08. These are public broadcaster feeds, not a CAPTCHA bypass or a
// claim that arbitrary Radio Garden pages are supported.
function knownStation(url: URL): StreamTrack | undefined {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "decayfm.com" && ["/", "/dkfm-2/", "/dkfm-2"].includes(url.pathname))
    return named("https://kathy.torontocast.com:2005/stream", "DKFM", "https://decayfm.com/");
  if (host === "radio.garden" && /^\/listen\/deeper-shades-of-house\/GFCK5Bn3\/?$/.test(url.pathname))
    return named("https://andromeda.housejunkie.ca/radio/8000/radio.mp3", "Deeper Shades of House", "https://radio.deepershades.net/");
}

export async function discoverFeeds(input: string, radio: boolean, signal: AbortSignal, fetcher: Fetcher = fetch): Promise<FeedResult> {
  const parsed = playbackUrl(input);
  signal.throwIfAborted();
  const known = knownStation(parsed);
  if (known) return { tracks: [known], note: "Known station feed · selected from the built-in compatibility list" };
  if (parsed.hostname.replace(/^www\./, "") === "radio.garden")
    throw Error("This Radio Garden station is not recognised yet. Paste the broadcaster's website or direct feed instead.");
  if (!/\.(pls|m3u)$/i.test(parsed.pathname)) {
    const track = trackFromUrl(parsed.href, radio);
    if (track.streamType === "extractor") return { tracks: [track], note: "YouTube link ready · metadata loads when played" };
  }
  const combined = AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
  try {
    // The public www site is the broadcaster's canonical page.
    if (parsed.hostname === "ibizastardustradio.com") parsed.hostname = "www.ibizastardustradio.com";
    const { response, url } = await request(parsed.href, combined, fetcher);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    const playlist = /mpegurl|scpls/.test(contentType) || /\.(m3u8?|pls)(?:[?#]|$)/i.test(url);
    if (!playlist && (/^audio\//.test(contentType) || response.headers.has("icy-name"))) {
      await response.body?.cancel();
      const live = radio || response.headers.has("icy-name");
      const track = trackFromUrl(parsed.href, live); // retain stable redirect URL, not an expiring destination
      track.title = cleanText(response.headers.get("icy-name") || track.title).slice(0, 120);
      return { tracks: [track], note: "Audio feed identified · nothing downloaded" };
    }
    const text = await readText(response);
    const tracks = playlist || /^\s*(?:#EXTM3U|\[playlist\])/i.test(text)
      ? feedsFromPlaylist(text, url) : feedsFromHtml(text, url);
    if (!tracks.length) throw Error("No public audio feeds found. The site may need JavaScript/login; paste its direct stream instead.");
    return { tracks, note: `Found ${tracks.length} feed${tracks.length === 1 ? "" : "s"} · select one to play or save` };
  } catch (error) {
    signal.throwIfAborted();
    if (combined.aborted) throw Error("Feed detection timed out. Try again or paste a direct stream.");
    if (error instanceof Error && /^(The site|The station|Too many|Station page|No public)/.test(error.message)) throw error;
    throw Error("Could not inspect this link. Check your connection or try the direct audio URL.");
  }
}
