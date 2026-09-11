import { execa } from "execa";
import { findOnPath } from "../util/exec";

/** No setup, writes, downloads, profile/config reads or network requests. */
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
  return { ok: tools.every(tool => tool.ok) && Number(process.versions.node.split(".")[0]) >= 22,
    platform: process.platform, architecture: process.arch, node: process.versions.node,
    terminal: { name: process.env.TERM_PROGRAM || "unknown", artworkOverride: process.env.JUKEBOXCLI_ART || "auto",
      multiplexer: Boolean(process.env.TMUX || process.env.STY),
      note: "Apple Terminal defaults to a simple drawing; JUKEBOXCLI_ART=blocks opts into pixel art. Kitty / iTerm2 capability is probed in the interactive app." },
    toolsMode: process.env.JUKEBOXCLI_SYSTEM_TOOLS === "1" ? "managed (no tool downloads/updates)" : "automatic (doctor only checks PATH)",
    mediaKeys: process.platform === "darwin" && process.env.JUKEBOXCLI_MEDIA_KEYS !== "0" ? "mpv bridge enabled; physical/system acceptance required" : "off",
    tools };
}
