import { promises as fs } from "node:fs";
import path from "node:path";
import { parseSpotifyInput } from "../sources/spotify/public";
import { normalizeSpotifyHandle } from "../sources/spotify/handle";
import { configFile, defaultLibraryDir } from "./paths";
import { resolveDefaultLibraryDir } from "./music-dir";

export interface Config {
  /** Player/queue palette; navigation retains the shared app palette. */
  playerTheme?: "lavender" | "calm";
  /** Disable decorative fallback animation (default true). */
  reducedMotion?: boolean;
  /** Where downloaded audio files live. */
  libraryDir: string;
  /** The user's YouTube handle (public playlists). */
  youtubeHandle?: string;
  /** The user's SoundCloud handle (public likes + sets). */
  soundcloudHandle?: string;
  /** The user's Spotify username (public playlists on their profile). */
  spotifyHandle?: string;
  /** @deprecated Migrated to spotifyHandle when it was a user id. */
  spotifyProfile?: string;
  /** Whether the first-run wizard has completed. */
  firstRunComplete: boolean;
  /** Check for yt-dlp updates at every launch (staged, applied when idle). */
  ytdlpAutoUpdate?: boolean;
  /** Path to a cookies.txt file for yt-dlp (Netscape format). Bypasses rate limits. */
  cookiesFile?: string;
  /** Browser profile for yt-dlp --cookies-from-browser (e.g. "chrome:Default"). Takes precedence over cookiesFile. */
  cookiesFromBrowser?: string;
  /** Audio format for downloads: "best" (default), "mp3", "flac", "wav", "m4a", "opus", "vorbis". */
  audioFormat?: string;
  /** Audio quality: 0 (best) to 10 (worst). Default 0. Only affects re-encoding. */
  audioQuality?: string;
  /** yt-dlp format string override (e.g. "bestaudio", "ba", "bestaudio[ext=m4a]"). */
  formatString?: string;
  /** Whether to re-encode to the target format even if best-available matches. */
  reencodeAudio?: boolean;
  /** Minimum sleep between downloads (seconds). Default 1. */
  sleepInterval?: number;
  /** Maximum sleep between downloads (seconds). Default 3. */
  maxSleepInterval?: number;
  /** Number of retries on failure. Default 5. */
  retries?: number;
  /** Embed subtitles if available. Default false. */
  embedSubs?: boolean;
  /** Embed chapters if available. Default false. */
  embedChapters?: boolean;
  /** Custom output template override (yt-dlp -o format string). If set, replaces the default. */
  outputTemplate?: string;
}

/** Drop deprecated keys before returning config or writing it to disk. */
export function stripDeprecatedConfig(config: Config): Config {
  const { spotifyProfile: _, ...rest } = config;
  return rest;
}

export const defaultConfig: Config = {
  playerTheme: "lavender",
  reducedMotion: true,
  libraryDir: defaultLibraryDir,
  youtubeHandle: undefined,
  soundcloudHandle: undefined,
  spotifyHandle: undefined,
  spotifyProfile: undefined,
  firstRunComplete: false,
  ytdlpAutoUpdate: true,
  cookiesFile: undefined,
  cookiesFromBrowser: undefined,
  audioFormat: "best",
  audioQuality: "0",
  formatString: undefined,
  reencodeAudio: false,
  sleepInterval: 1,
  maxSleepInterval: 3,
  retries: 5,
  embedSubs: false,
  embedChapters: false,
  outputTemplate: undefined,
};

export async function loadConfig(): Promise<Config> {
  let raw: string;
  try {
    raw = await fs.readFile(configFile, "utf8");
  } catch {
    // True first run (no config yet): ask the OS where Music really lives.
    // Once a config file exists this never runs again, so the registry is
    // queried at most once per machine.
    return { ...defaultConfig, libraryDir: process.env.JUKEBOXCLI_HOME ? defaultLibraryDir : await resolveDefaultLibraryDir() };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<Config>;
    const cfg = { ...defaultConfig, ...parsed };
    cfg.playerTheme = parsed.playerTheme === "calm" ? "calm" : "lavender";
    cfg.reducedMotion = typeof parsed.reducedMotion === "boolean" ? parsed.reducedMotion : true;
    if (!cfg.spotifyHandle && parsed.spotifyProfile) {
      const ref = parseSpotifyInput(parsed.spotifyProfile);
      if (ref.type === "user") {
        cfg.spotifyHandle = normalizeSpotifyHandle(parsed.spotifyProfile);
      }
    }
    return stripDeprecatedConfig(cfg);
  } catch {
    return { ...defaultConfig };
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(
    configFile,
    JSON.stringify(stripDeprecatedConfig(config), null, 2),
    "utf8",
  );
  // Pre-create the music folder so downloads and "open folder" always land
  // somewhere real; a bad path must never break a config save.
  await fs.mkdir(config.libraryDir, { recursive: true }).catch(() => {});
}
