import { execa } from "execa";
import { findOnPath } from "../util/exec";
import { visualizerEnabled } from "../player/spectrum";
import { promises as fs } from "node:fs";
import { configFile } from "../config/paths";
import { ytDlpPath } from "../bin/ytdlp-fetch";

/** Read-only diagnostics: no setup, writes, downloads or network requests. */
export async function installationReport() {
  const tools = await Promise.all(["mpv", "ffmpeg", "ffprobe", "yt-dlp"].map(async name => {
    const executable = name === "mpv" && process.env.SOUNDCLI_MPV ? process.env.SOUNDCLI_MPV : await findOnPath(name);
    if (!executable) return { name, ok: false, error: "Not on PATH" };
    // Python-based yt-dlp can start slowly on a cold installation.
    const timeout = name === "yt-dlp" ? 15000 : 5000;
    try {
      const result = await execa(executable, [name.startsWith("ff") ? "-version" : "--version"], { timeout });
      return { name, ok: true, path: executable, version: result.stdout.split("\n")[0]?.slice(0, 200) };
    } catch (error) {
      const failure = error as { timedOut?: boolean; exitCode?: number; code?: string } | null;
      const reason = failure?.timedOut ? `Timed out after ${timeout / 1000} seconds` :
        typeof failure?.exitCode === "number" ? `Exited with code ${failure.exitCode}` : "Could not start executable";
      return { name, ok: false, path: executable, error: reason };
    }
  }));
  let managedYtDlp: { path: string; version?: string; channel: string; error?: string } | undefined;
  if (process.env.JUKEBOXCLI_SYSTEM_TOOLS !== "1") {
    const managedPath = ytDlpPath();
    let channel = "nightly";
    try { channel = JSON.parse(await fs.readFile(configFile, "utf8")).ytdlpChannel === "stable" ? "stable" : "nightly"; } catch { /* default */ }
    try {
      const result = await execa(managedPath, ["--version"], { timeout: 15_000 });
      managedYtDlp = { path: managedPath, version: result.stdout.trim().slice(0, 200), channel };
    } catch { managedYtDlp = { path: managedPath, channel, error: "Not installed yet" }; }
  }
  const requiredToolsOk = tools.filter(tool => tool.name !== "yt-dlp").every(tool => tool.ok);
  const ytDlpOk = tools.find(tool => tool.name === "yt-dlp")?.ok === true || Boolean(managedYtDlp?.version);
  return { ok: requiredToolsOk && ytDlpOk && Number(process.versions.node.split(".")[0]) >= 22,
    platform: process.platform, architecture: process.arch, node: process.versions.node,
    terminal: { name: process.env.TERM_PROGRAM || "unknown", artworkOverride: process.env.JUKEBOXCLI_ART || "auto",
      multiplexer: Boolean(process.env.TMUX || process.env.STY),
      note: "Apple Terminal defaults to a simple drawing; Kitty, Sixel and iTerm2 capability is probed in the interactive app." },
    toolsMode: process.env.JUKEBOXCLI_SYSTEM_TOOLS === "1" ? "system-managed tools (no app downloads/updates)" : "automatic (PATH plus managed yt-dlp)",
    mediaKeys: process.platform === "darwin" && process.env.JUKEBOXCLI_MEDIA_KEYS !== "0" ? "mpv bridge enabled; physical/system acceptance required" : "off",
    visualizer: visualizerEnabled() ? "enabled" : process.platform === "linux"
      ? "disabled by JUKEBOXCLI_VISUALIZER=0"
      : "off (set JUKEBOXCLI_VISUALIZER=1 to enable)",
    managedYtDlp, tools };
}
