import { execa } from "execa";
import { resolvedYtDlpPath } from "../bin/ytdlp-fetch";
import { jsRuntimeArgs, toolEnv } from "../bin/binaries";
import { cookieArgs } from "../ytdlp/args";
import type { Config } from "../config/config";
import { isHttpUrl, type MediaResolver, type ResolvedMedia } from "./media";

/** Sanitise extractor output: signed URLs stay in memory and never in errors. */
export function resolvedMedia(info: Record<string, unknown>, now = Date.now()): ResolvedMedia {
  if (!isHttpUrl(info.url)) throw new Error("No playable audio stream was returned.");
  const expiry = Number(new URL(info.url).searchParams.get("expire")) * 1000;
  const expiresAt = Math.min(now + 5 * 60_000, expiry > now ? expiry - 30_000 : Infinity);
  const headers: Record<string, string> = {};
  if (info.http_headers && typeof info.http_headers === "object") {
    for (const [name, value] of Object.entries(info.http_headers)) {
      if (/^(user-agent|referer|origin|accept|accept-language)$/i.test(name) && typeof value === "string" && !/[\r\n]/.test(value)) headers[name] = value;
    }
  }
  return { url: info.url, headers, expiresAt };
}

export function createStreamResolver(config: () => Promise<Config>): MediaResolver {
  const cache = new Map<string, ResolvedMedia>();
  return async (track, signal, fresh = false) => {
    if (!isHttpUrl(track.streamUrl)) throw new Error("Only HTTP(S) stream links are supported.");
    signal.throwIfAborted();
    if (track.streamType === "direct" || track.streamType === "radio") {
      return { url: track.streamUrl, expiresAt: Infinity };
    }
    const cached = cache.get(track.streamUrl);
    if (!fresh && cached && cached.expiresAt > Date.now()) return cached;
    signal.throwIfAborted();
    const cfg = await config();
    signal.throwIfAborted();
    try {
      const { stdout } = await execa(resolvedYtDlpPath(), [
        "--ignore-config", "--no-warnings", "--no-playlist", "--skip-download", "--dump-single-json",
        "--format", "bestaudio/best", "--socket-timeout", "15", "--retries", "1",
        ...jsRuntimeArgs(), ...cookieArgs(cfg), "--", track.streamUrl,
      ], { env: toolEnv(), cancelSignal: signal, timeout: 45_000, maxBuffer: 8 * 1024 * 1024 });
      signal.throwIfAborted();
      const info = JSON.parse(stdout);
      const media = resolvedMedia(info);
      media.metadata = {
        title: typeof info.title === "string" ? info.title : track.title,
        artist: typeof info.artist === "string" ? info.artist : typeof info.uploader === "string" ? info.uploader : track.artist,
        durationSec: typeof info.duration === "number" && Number.isFinite(info.duration) && info.duration >= 0 ? info.duration : undefined,
        thumbnailUrl: isHttpUrl(info.thumbnail) ? info.thumbnail : track.thumbnailUrl,
        isLive: info.is_live === true || info.live_status === "is_live",
      };
      if (cache.size >= 100) cache.delete(cache.keys().next().value!);
      cache.set(track.streamUrl, media);
      return media;
    } catch (error) {
      signal.throwIfAborted();
      const stderr = (error as { stderr?: string }).stderr ?? "";
      if (/403|429|sign in|confirm.*bot|cookies|login/i.test(stderr)) {
        throw new Error("Streaming was blocked by the source. Check browser cookies in Settings or try another result.");
      }
      throw new Error("Could not resolve this stream. Check your connection or try another result.");
    }
  };
}
