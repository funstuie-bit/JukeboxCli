import { execa } from "execa";
import { resolvedYtDlpPath } from "../bin/ytdlp-fetch";
import { jsRuntimeArgs, toolEnv } from "../bin/binaries";
import { cookieArgs } from "../ytdlp/args";
import type { Config } from "../config/config";
import { isHttpUrl, StreamResolutionError, type MediaResolver, type ResolvedMedia, type PlaybackMode } from "./media";

function safeHeaders(value: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (value && typeof value === "object") {
    for (const [name, content] of Object.entries(value)) {
      if (/^(user-agent|referer|origin|accept|accept-language)$/i.test(name) && typeof content === "string" && !/[\r\n]/.test(content)) headers[name] = content;
    }
  }
  return headers;
}

function streamExpiry(url: string, now: number): number {
  const expiry = Number(new URL(url).searchParams.get("expire")) * 1000;
  return expiry > 0 && Number.isFinite(expiry) ? expiry - 30_000 : now + 5 * 60_000;
}

/** Sanitise extractor output: signed URLs stay in memory and never in errors. */
export function resolvedMedia(info: Record<string, unknown>, now = Date.now(), mode: PlaybackMode = "audio"): ResolvedMedia {
  const formats = Array.isArray(info.requested_formats)
    ? info.requested_formats.filter((f): f is Record<string, unknown> => !!f && typeof f === "object") : [];
  const video = mode === "video" ? formats.find(f => typeof f.vcodec === "string" && f.vcodec !== "none") : undefined;
  // HLS audio selections can omit acodec until demuxing. vcodec=none still
  // identifies the selected audio-only member; don't silently discard it.
  const audio = video ? formats.find(f => f.vcodec === "none" && (f.acodec === undefined || (typeof f.acodec === "string" && f.acodec !== "none"))) : undefined;
  const selected = video ?? info;
  if (mode === "video" && selected.vcodec === "none") throw new StreamResolutionError("no-video");
  if (!isHttpUrl(selected.url)) throw new StreamResolutionError(selected.url ? "invalid-url" : "no-stream");
  if (audio && !isHttpUrl(audio.url)) throw new StreamResolutionError("invalid-url");
  const headers = safeHeaders(info.http_headers);
  for (const [name, value] of Object.entries(safeHeaders(selected.http_headers))) {
    const key = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase()) ?? name;
    headers[key] = value;
  }
  // mpv's loadfile options apply to both streams. Refuse conflicting headers
  // rather than quietly sending one stream the other's credentials/settings.
  for (const [name, value] of Object.entries(safeHeaders(audio?.http_headers))) {
    const key = Object.keys(headers).find(key => key.toLowerCase() === name.toLowerCase()) ?? name;
    if (headers[key] !== undefined && headers[key] !== value) throw new StreamResolutionError("incompatible-headers");
    headers[key] = value;
  }
  const audioUrl = audio?.url as string | undefined;
  const expiresAt = Math.min(now + 5 * 60_000, streamExpiry(selected.url, now), audioUrl ? streamExpiry(audioUrl, now) : Infinity);
  return { url: selected.url, ...(audioUrl ? { audioUrl } : {}), headers, expiresAt };
}

export function createStreamResolver(config: () => Promise<Config>): MediaResolver {
  const cache = new Map<string, ResolvedMedia>();
  let cookieSelection: string | undefined;
  return async (track, signal, fresh = false, mode = "audio", options) => {
    if (!isHttpUrl(track.streamUrl)) throw new Error("Only HTTP(S) stream links are supported.");
    signal.throwIfAborted();
    if (track.streamType === "direct" || track.streamType === "radio") {
      return { url: track.streamUrl, expiresAt: Infinity };
    }
    const cacheKey = `${options?.withoutCookies ? "anonymous" : "configured"}:${mode}:${track.streamUrl}`;
    const cfg = await config();
    signal.throwIfAborted();
    const selectedCookies = JSON.stringify(cookieArgs(cfg));
    if (selectedCookies !== cookieSelection) { cache.clear(); cookieSelection = selectedCookies; }
    const cached = cache.get(cacheKey);
    if (!fresh && cached && cached.expiresAt > Date.now()) return cached;
    signal.throwIfAborted();
    try {
      // Some YouTube direct audio links resolve successfully but return 403
      // when opened. The existing single retry can choose HLS audio instead,
      // without dropping configured cookies or reducing the video resolution.
      const preferHlsAudio = fresh && track.source === "youtube";
      const format = mode === "video"
        ? `${preferHlsAudio ? "bestvideo+bestaudio[protocol^=m3u8]/" : ""}bestvideo+bestaudio/best/bestvideo`
        : `${preferHlsAudio ? "bestaudio[protocol^=m3u8]/" : ""}bestaudio/best`;
      const { stdout } = await execa(resolvedYtDlpPath(), [
        "--ignore-config", "--no-warnings", "--no-playlist", "--skip-download", "--dump-single-json",
        "--format", format, "--socket-timeout", "15", "--retries", "1",
        ...jsRuntimeArgs(), ...(options?.withoutCookies ? [] : cookieArgs(cfg)), "--", track.streamUrl,
      ], { env: toolEnv(), cancelSignal: signal, timeout: 45_000, maxBuffer: 8 * 1024 * 1024 });
      signal.throwIfAborted();
      const info = JSON.parse(stdout);
      const media = resolvedMedia(info, Date.now(), mode);
      media.metadata = {
        title: typeof info.title === "string" ? info.title : track.title,
        artist: typeof info.artist === "string" ? info.artist : typeof info.uploader === "string" ? info.uploader : track.artist,
        durationSec: typeof info.duration === "number" && Number.isFinite(info.duration) && info.duration >= 0 ? info.duration : undefined,
        thumbnailUrl: isHttpUrl(info.thumbnail) ? info.thumbnail : track.thumbnailUrl,
        isLive: info.is_live === true || info.live_status === "is_live",
      };
      if (cookieSelection === selectedCookies) {
        if (cache.size >= 100) cache.delete(cache.keys().next().value!);
        cache.set(cacheKey, media);
      }
      return media;
    } catch (error) {
      signal.throwIfAborted();
      if (error instanceof StreamResolutionError) throw error;
      const stderr = (error as { stderr?: string }).stderr ?? "";
      if (/could not find.*cookies|could not copy.*cookies|failed to (?:decrypt|load).*cookies|could not.*decrypt|does not look like a Netscape|permission denied.*cookies/i.test(stderr)) throw new StreamResolutionError("cookies");
      if (/requested format.*not available|no video formats|only images are available/i.test(stderr)) throw new StreamResolutionError("format");
      if (/403|429|sign in|confirm.*bot|cookies|login/i.test(stderr)) {
        throw new StreamResolutionError("blocked");
      }
      if (/video unavailable|private video|video.*removed|not available in your country|age.restricted/i.test(stderr)) throw new StreamResolutionError("unavailable");
      if ((error as { timedOut?: boolean }).timedOut || /timed? out|timeout/i.test(stderr)) throw new StreamResolutionError("timeout");
      throw new StreamResolutionError("lookup");
    }
  };
}
