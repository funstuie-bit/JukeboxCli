import path from "node:path";
import type { Config } from "../config/config";

/** yt-dlp audio extraction args: configurable format + quality. */
export function audioFormatArgs(config?: Pick<Config, "audioFormat" | "audioQuality" | "formatString" | "reencodeAudio">): string[] {
  const args: string[] = ["-x"];
  
  // Format string override (e.g. "bestaudio", "bestaudio[ext=m4a]")
  if (config?.formatString) {
    args.push("-f", config.formatString);
  }
  
  // Audio format conversion
  const fmt = config?.audioFormat ?? "best";
  if (fmt && fmt !== "best") {
    args.push("--audio-format", fmt);
    // Force re-encode if requested (otherwise yt-dlp skips if already matching)
    if (config?.reencodeAudio) {
      args.push("--postprocessor-args", "ffmpeg:-c:a libmp3lame -q:a 0");
    }
  }
  
  // Audio quality (0=best, 10=worst)
  const quality = config?.audioQuality ?? "0";
  if (quality && quality !== "0") {
    args.push("--audio-quality", quality);
  }
  
  return args;
}

/** Cookie args for yt-dlp, if cookies are configured.
 *  cookiesFromBrowser takes precedence over cookiesFile. */
export function cookieArgs(config?: Pick<Config, "cookiesFile" | "cookiesFromBrowser">): string[] {
  if (config?.cookiesFromBrowser) {
    return ["--cookies-from-browser", config.cookiesFromBrowser];
  }
  if (config?.cookiesFile) {
    return ["--cookies", config.cookiesFile];
  }
  return [];
}

/** Extra download args from config (sleep, retries, embeds). */
export function extraDownloadArgs(config?: Pick<Config, "sleepInterval" | "maxSleepInterval" | "retries" | "embedSubs" | "embedChapters">): string[] {
  const args: string[] = [];
  const sleepMin = config?.sleepInterval ?? 1;
  const sleepMax = config?.maxSleepInterval ?? 3;
  args.push("--sleep-interval", String(sleepMin));
  args.push("--max-sleep-interval", String(sleepMax));
  const retries = config?.retries ?? 5;
  args.push("--retries", String(retries));
  args.push("--retry-sleep", "5");
  if (config?.embedSubs) {
    args.push("--embed-subs");
  }
  if (config?.embedChapters) {
    args.push("--embed-chapters");
  }
  return args;
}

/**
 * Output filename template:
 *   <library>/<Source>/<owner?>/<Playlist or "Singles">/<Artist> - <Title>.<ext>
 * Uses yt-dlp field alternation (artist then uploader) with sensible defaults.
 * The owner segment (the normalized handle) keeps collections from different
 * handles apart on disk.
 */
export function outputTemplate(
  libraryDir: string,
  sourceLabel: string,
  owner?: string,
): string {
  return path.join(
    libraryDir,
    sourceLabel,
    ...(owner ? [sanitizeName(owner)] : []),
    "%(playlist_title|Singles)s",
    "%(artist,uploader|Unknown Artist)s - %(track,title)s.%(ext)s",
  );
}

/** Remove characters that are illegal in filenames across OSes. */
export function sanitizeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return cleaned || "track";
}

/**
 * Output template with a caller-supplied folder but yt-dlp's own filename.
 * Used by YouTube/SoundCloud so a single-track download (which has no
 * playlist_title of its own under --no-playlist) still lands in the playlist /
 * "Liked Songs" folder it came from, instead of falling back to "Singles".
 */
export function outputTemplateInFolder(
  libraryDir: string,
  sourceLabel: string,
  playlist: string,
  owner?: string,
): string {
  return path.join(
    libraryDir,
    sourceLabel,
    ...(owner ? [sanitizeName(owner)] : []),
    sanitizeName(playlist),
    "%(artist,uploader|Unknown Artist)s - %(track,title)s.%(ext)s",
  );
}

/**
 * Output template with caller-supplied playlist + filename (used by Spotify,
 * where names come from Spotify rather than the matched YouTube video).
 */
export function outputTemplateFixed(
  libraryDir: string,
  sourceLabel: string,
  playlist: string,
  stem: string,
): string {
  return path.join(
    libraryDir,
    sourceLabel,
    sanitizeName(playlist),
    `${sanitizeName(stem)}.%(ext)s`,
  );
}
