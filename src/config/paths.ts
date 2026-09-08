import os from "node:os";
import path from "node:path";
import envPaths from "env-paths";

export const APP_NAME = "soundcli";

/** OS-appropriate config / data / cache directories. */
const legacyPaths = envPaths(APP_NAME, { suffix: "" });
/** Isolated portable profile; default retains existing soundcli data. */
const profile = process.env.JUKEBOXCLI_HOME;
export const paths = profile
  ? { config: path.resolve(profile, "config"), data: path.resolve(profile, "data"),
      cache: path.resolve(profile, "cache"), log: path.resolve(profile, "logs"),
      temp: path.resolve(profile, "temp") }
  : legacyPaths;

/** Directory where downloaded tool binaries (yt-dlp) are cached. */
export const binDir = path.join(paths.cache, "bin");

/** Default location for the downloaded music library. */
export const defaultLibraryDir = profile ? path.resolve(profile, "music") : path.join(os.homedir(), "Music", APP_NAME);

/** Path to the JSON config file. */
export const configFile = path.join(paths.config, "config.json");

/** Path to the JSON library index. */
export const libraryIndexFile = path.join(paths.data, "library.json");

/** Persisted download queue, so pending/paused downloads survive a restart. */
export const queueFile = path.join(paths.data, "queue.json");

/** Recently played history, newest first. */
export const historyFile = path.join(paths.data, "history.json");

/** Legacy yt-dlp download archive, removed on boot (library is now the source of truth). */
export const legacyArchiveFile = path.join(paths.data, "download-archive.txt");

/** Raw download-failure log (the UI shows short reasons; this keeps the data). */
export const downloadLogFile = path.join(paths.log, "downloads.log");
