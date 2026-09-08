import { createHash } from "node:crypto";
import type { StreamTrack } from "./media";

/** Only intentional HTTP(S) playback; no shell, local paths or URL credentials. */
export function playbackUrl(input: string): URL {
  const value = input.trim();
  if (value.length > 8192 || /[\x00-\x20\x7f]/.test(value)) throw new Error("Paste one complete HTTP(S) URL, with no spaces.");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a complete URL starting with https:// or http://."); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only HTTP(S) links are supported.");
  if (url.username || url.password) throw new Error("Links containing a username or password are not supported.");
  url.hash = "";
  return url;
}

const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);

/** No network lookup until playback. Never store tracking/signed YouTube links. */
export function trackFromUrl(input: string, radio = false): StreamTrack {
  const url = playbackUrl(input);
  if (youtubeHosts.has(url.hostname.toLowerCase())) {
    const id = url.hostname.endsWith("youtu.be") ? url.pathname.slice(1)
      : url.pathname === "/watch" ? url.searchParams.get("v")
      : /^\/(shorts|live|embed)\//.test(url.pathname) ? url.pathname.split("/")[2] : null;
    if (!id || !/^[\w-]{11}$/.test(id)) throw new Error("Use a YouTube video, Shorts or live link. Playlist/channel links are not supported here; use 8 Discover.");
    const streamUrl = `https://www.youtube.com/watch?v=${id}`;
    return { kind: "stream", id: `stream:youtube:${id}`, source: "youtube", sourceTrackId: id,
      title: `YouTube · ${id}`, streamUrl, webpageUrl: streamUrl, streamType: "extractor",
      thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, addedAt: new Date().toISOString() };
  }
  // Radio needs an actual endpoint, not a station homepage. mpv determines
  // whether it can decode the response. Never send unrelated browser cookies.
  const streamUrl = url.href;
  if (/\.(pls|m3u)$/i.test(url.pathname)) throw new Error("Use the station's direct audio or HLS (.m3u8) endpoint, not a PLS/M3U station list.");
  const type = radio ? "radio" : "direct";
  const id = createHash("sha256").update(streamUrl).digest("hex");
  return { kind: "stream", id: `stream:${type}:${id}`, source: "link", sourceTrackId: id,
    title: `${radio ? "Radio" : "Audio"} · ${url.hostname}`, streamUrl, webpageUrl: streamUrl,
    streamType: type, isLive: radio, addedAt: new Date().toISOString() };
}
