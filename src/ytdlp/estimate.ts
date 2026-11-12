import { execa } from "execa";
import type { Config } from "../config/config";
import type { StreamTrack } from "../player/media";
import { resolvedYtDlpPath } from "../bin/ytdlp-fetch";
import { jsRuntimeArgs, toolEnv } from "../bin/binaries";
import { audioFormatArgs, cookieArgs } from "./args";

export interface DownloadEstimate { bytes?: number; approximate?: boolean; converted?: boolean }
/** Only numeric size metadata leaves this boundary; never retain signed URLs. */
export function estimateFromInfo(info: any, config: Pick<Config, "audioFormat" | "reencodeAudio">): DownloadEstimate {
  if (info?.is_live || info?.live_status === "is_live") return {};
  const formats = Array.isArray(info?.requested_downloads) ? info.requested_downloads : Array.isArray(info?.requested_formats) ? info.requested_formats : [info];
  const sizes = formats.map((f: any) => ({ bytes: f?.filesize ?? f?.filesize_approx, approximate: !f?.filesize }));
  const converted = !!config.reencodeAudio || !!(config.audioFormat && config.audioFormat !== "best") || formats.some((f: any) => f?.vcodec && f.vcodec !== "none");
  if (!sizes.length || sizes.some((s: any) => typeof s.bytes !== "number" || !Number.isFinite(s.bytes) || s.bytes <= 0)) return { converted };
  return { bytes: sizes.reduce((n: number, s: any) => n + s.bytes, 0), approximate: sizes.some((s: any) => s.approximate), converted };
}
export function estimateLabel(value?: DownloadEstimate): string {
  if (!value?.bytes) return "Audio size unknown";
  const size = value.bytes >= 1024 ** 3 ? `${(value.bytes / 1024 ** 3).toFixed(1)} GB` : `${(value.bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${value.approximate ? "~" : ""}${size} ${value.converted ? "source · saved size unknown" : "audio download estimate"}`;
}
/** One bounded cache per UI consumer. An aborted/failed lookup is never cached. */
export function createSizeEstimator(lookup = async (args: string[], signal: AbortSignal) => {
  const { stdout } = await execa(resolvedYtDlpPath(), args, { env: toolEnv(), cancelSignal: signal, timeout: 15_000, maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout);
}) {
  const cache = new Map<string, { at: number; value: DownloadEstimate }>();
  return async (track: StreamTrack, config: Config, signal: AbortSignal): Promise<DownloadEstimate> => {
    if (!config.downloadEstimates || track.isLive) return {};
    signal.throwIfAborted();
    const key = JSON.stringify([track.id, audioFormatArgs(config), cookieArgs(config)]);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 300_000) return hit.value;
    const info = await lookup(["--ignore-config", "--no-cache-dir", "--no-playlist", "--no-warnings", "--skip-download", "--dump-single-json",
      "--socket-timeout", "8", "--retries", "0", ...jsRuntimeArgs(), ...audioFormatArgs(config), ...cookieArgs(config), "--", track.streamUrl], signal);
    signal.throwIfAborted();
    const value = estimateFromInfo(info, config);
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), value }); return value;
  };
}
