import { promises as fs } from "node:fs";
import path from "node:path";
import { execa } from "execa";
import { binDir } from "../config/paths";
import { findOnPath } from "../util/exec";
import { fetchResilient, USER_AGENT, type FetchImpl } from "../util/net";
import { ytDlpProvider, type YtDlpProvider } from "./ytdlp-policy";

export type YtDlpChannel = "stable" | "nightly";
const RELEASE_REPO: Record<YtDlpChannel, string> = {
  stable: "yt-dlp/yt-dlp",
  nightly: "yt-dlp/yt-dlp-nightly-builds",
};

/** Name of the release asset that matches the current platform/arch. */
function assetName(): string {
  const { platform, arch } = process;
  if (platform === "win32") {
    return arch === "ia32" ? "yt-dlp_x86.exe" : "yt-dlp.exe";
  }
  if (platform === "darwin") {
    return "yt-dlp_macos"; // universal2 binary
  }
  // linux and other unix
  if (arch === "arm64") return "yt-dlp_linux_aarch64";
  if (arch === "arm") return "yt-dlp_linux_armv7l";
  return "yt-dlp_linux";
}

/** Local path where we store the yt-dlp binary. */
export function ytDlpPath(): string {
  const name = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  return path.join(binDir, name);
}

/** Where a freshly downloaded update waits until the next launch promotes it. */
export function stagedYtDlpPath(): string {
  return `${ytDlpPath()}.new`;
}

/**
 * Download the latest release asset to `dest`. Writes to a temp file and
 * renames, so a crash mid-download can never leave a torn exe that later
 * looks installed.
 */
export async function downloadYtDlp(
  dest: string,
  fetchImpl: FetchImpl = fetch as FetchImpl,
  channel: YtDlpChannel = "stable",
): Promise<void> {
  await fs.mkdir(binDir, { recursive: true });
  const url = `https://github.com/${RELEASE_REPO[channel]}/releases/latest/download/${assetName()}`;
  const res = await fetchResilient(url, {
    fetchImpl,
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to download yt-dlp from ${url}: ${res.status} ${res.statusText}`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = `${dest}.tmp`;
  await fs.writeFile(tmp, buf);
  if (process.platform !== "win32") {
    await fs.chmod(tmp, 0o755);
  }
  await fs.rename(tmp, dest);
}

/**
 * Promote a staged update to the live path. Runs before anything spawns the
 * binary, so this process never holds it; a second running soundcli instance
 * can (EBUSY/EPERM on Windows), in which case the old binary stays and we
 * retry next launch. The rename dance keeps a working binary on disk at
 * every instant.
 */
export async function finalizeStagedYtDlp(): Promise<boolean> {
  const staged = stagedYtDlpPath();
  const dest = ytDlpPath();
  try {
    await fs.access(staged);
  } catch {
    return false; // nothing staged
  }
  const old = `${dest}.old`;
  // A leftover .old from a previous locked run; clearing it is best-effort.
  await fs.rm(old, { force: true }).catch(() => {});
  let hadCurrent = true;
  try {
    await fs.rename(dest, old);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      hadCurrent = false; // no live binary yet; the staged one becomes it
    } else {
      return false; // live exe is in use by another instance
    }
  }
  try {
    await fs.rename(staged, dest);
  } catch {
    if (hadCurrent) await fs.rename(old, dest).catch(() => {});
    return false;
  }
  await fs.rm(old, { force: true }).catch(() => {});
  return true;
}

// Standalone builds can take more than ten seconds on a cold Mac launch.
export const YTDLP_STARTUP_TIMEOUT_MS = 60_000;

export async function checkYtDlpStartup(dest: string): Promise<boolean> {
  try {
    await execa(dest, ["--version"], { timeout: YTDLP_STARTUP_TIMEOUT_MS });
    return true;
  } catch (error) {
    const failure = error as { timedOut?: boolean; exitCode?: number; code?: string; signal?: string };
    const reason = failure?.timedOut ? "startup timed out after 60 seconds"
      : failure?.signal ? `startup was terminated (${failure.signal})`
      : typeof failure?.exitCode === "number" ? `startup exited with code ${failure.exitCode}`
      : failure?.code ? `could not start (${failure.code})` : "startup check failed";
    throw new Error(reason);
  }
}

async function probeBinary(dest: string): Promise<boolean> {
  try {
    return await checkYtDlpStartup(dest);
  } catch {
    return false;
  }
}

/**
 * A usable yt-dlp already on the user's PATH, or null. The rescue when our own
 * download is blocked (some networks 403 GitHub release assets). Seams injected
 * for tests.
 */
export async function detectSystemYtDlp(
  find: (name: string) => Promise<string | null> = findOnPath,
  probe: (p: string) => Promise<boolean> = probeBinary,
): Promise<string | null> {
  const found = await find("yt-dlp");
  return found && (await probe(found)) ? found : null;
}

/**
 * Download to `dest`, then check the binary actually runs. A failed probe
 * can have several causes; retry once before giving up and report the reason.
 * The download/probe/remove seams are injectable for tests.
 */
export async function downloadVerified(
  dest: string,
  download: (dest: string) => Promise<void> = downloadYtDlp,
  probe: (dest: string) => Promise<boolean> = checkYtDlpStartup,
  remove: (p: string) => Promise<void> = async (p) => {
    await fs.rm(p, { force: true });
  },
): Promise<void> {
  let reason = "startup check failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    await download(dest);
    try {
      if (await probe(dest)) return;
    } catch (error) {
      reason = error instanceof Error ? error.message : "startup check failed";
    }
    // An unusable download must not pass the existence check next launch.
    await remove(dest);
  }
  throw new Error(
    `JukeboxCli downloaded yt-dlp, but verification failed: ${reason}. The update was not installed.`,
  );
}

/**
 * Decide which yt-dlp to use: the bundled binary if present, else download our
 * own exactly as before, and only if that download is blocked, fall back to a
 * system yt-dlp on PATH. The download path is untouched for everyone whose
 * fetch works; detection runs only when it fails. Seam-injected and free of
 * module state, so the ordering is unit-testable.
 *
 * The system fallback is a crutch, not a destination: a transient network
 * failure would otherwise silently downgrade this install forever. The
 * caller (ensureYtDlp) schedules a background re-fetch when this happens,
 * and the next launch picks the bundled binary up through the normal path.
 */
export async function resolveYtDlp(
  onStatus?: (msg: string) => void,
  deps: {
    dest?: string;
    exists?: (p: string) => Promise<boolean>;
    detect?: () => Promise<string | null>;
    download?: (dest: string) => Promise<void>;
    onSystemFallback?: (path: string) => void;
  } = {},
): Promise<string> {
  const dest = deps.dest ?? ytDlpPath();
  const exists =
    deps.exists ??
    (async (p: string) => {
      try {
        await fs.access(p);
        return true;
      } catch {
        return false;
      }
    });
  const detect = deps.detect ?? (() => detectSystemYtDlp());
  const download = deps.download ?? downloadVerified;
  const onSystemFallback = deps.onSystemFallback;

  // Already installed: the normal path, completely unchanged.
  if (await exists(dest)) return dest;

  // First run: fetch our own binary, exactly as before.
  try {
    onStatus?.("downloading yt-dlp (one-time setup)…");
    await download(dest);
    onStatus?.("yt-dlp ready.");
    return dest;
  } catch (e) {
    // The download is blocked on some networks (GitHub 403 on mobile/CGNAT/
    // datacenter/Termux). A working system yt-dlp is the backup; with none,
    // surface the real download failure.
    const system = await detect();
    if (system) {
      onStatus?.("using yt-dlp from your system");
      onSystemFallback?.(system);
      return system;
    }
    throw e;
  }
}

let inflight: Promise<string> | null = null;
let resolvedYtDlp: string | null = null;

/**
 * The yt-dlp we actually spawn (enumeration + downloads): the bundled binary,
 * or a detected system one when the bundled download was blocked. Falls back to
 * the bundled-path math until the first ensure resolves it.
 */
export function resolvedYtDlpPath(): string {
  return resolvedYtDlp ?? ytDlpPath();
}

/**
 * Ensure a usable yt-dlp, downloading on first run only when neither a bundled
 * nor a system binary is available. Returns the resolved path. Concurrent
 * callers share one run; a failed run clears, so the next call retries fresh.
 */
export function ensureYtDlp(onStatus?: (msg: string) => void, channel: YtDlpChannel = "stable", provider?: YtDlpProvider): Promise<string> {
  inflight ??= doEnsure(onStatus, channel, provider).finally(() => {
    inflight = null;
  });
  return inflight;
}

async function doEnsure(onStatus?: (msg: string) => void, channel: YtDlpChannel = "stable", provider?: YtDlpProvider): Promise<string> {
  if (resolvedYtDlp) return resolvedYtDlp;
  if (ytDlpProvider(provider) === "system") {
    const system = await detectSystemYtDlp();
    if (!system) throw new Error("System yt-dlp is missing. Install it with your package manager (on Mac: brew install yt-dlp).");
    resolvedYtDlp = system;
    return system;
  }
  // A staged update (from the daily check) applies before first use.
  await finalizeStagedYtDlp().catch(() => false);
  resolvedYtDlp = await resolveYtDlp(onStatus, {
    download: (dest) => downloadVerified(dest, (target) => downloadYtDlp(target, undefined, channel)),
    // A transient download failure silently downgrades this install to a
    // system yt-dlp. The fallback keeps working, but the missing bundled
    // binary is a live problem: retry the fetch in the background (a stale
    // system yt-dlp breaks downloads silently over time), so the next
    // launch takes the normal bundled path without the user ever knowing.
    onSystemFallback: (path) => {
      if (path) {
        void downloadVerified(ytDlpPath(), (target) => downloadYtDlp(target, undefined, channel)).catch(() => {});
      }
    },
  });
  return resolvedYtDlp;
}
