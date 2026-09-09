import { execa } from "execa";
import { findOnPath } from "../util/exec";

/** No setup, writes, downloads, profile/config reads or network requests. */
export async function installationReport() {
  const tools = await Promise.all(["mpv", "ffmpeg", "ffprobe", "yt-dlp"].map(async name => {
    const executable = name === "mpv" && process.env.SOUNDCLI_MPV ? process.env.SOUNDCLI_MPV : await findOnPath(name);
    if (!executable) return { name, ok: false, error: "Not on PATH" };
    try {
      const result = await execa(executable, [name.startsWith("ff") ? "-version" : "--version"], { timeout: 5000 });
      return { name, ok: true, path: executable, version: result.stdout.split("\n")[0]?.slice(0, 200) };
    } catch { return { name, ok: false, path: executable, error: "Could not run (5-second timeout)" }; }
  }));
  return { ok: tools.every(tool => tool.ok) && Number(process.versions.node.split(".")[0]) >= 22,
    platform: process.platform, architecture: process.arch, node: process.versions.node,
    terminal: { name: process.env.TERM_PROGRAM || "unknown", artworkOverride: process.env.JUKEBOXCLI_ART || "auto",
      multiplexer: Boolean(process.env.TMUX || process.env.STY),
      note: "Artwork capability is probed only in the interactive app; Kitty / iTerm2 inline / text fallback." },
    toolsMode: process.env.JUKEBOXCLI_SYSTEM_TOOLS === "1" ? "managed (no tool downloads/updates)" : "automatic (doctor only checks PATH)",
    mediaKeys: process.platform === "darwin" && process.env.JUKEBOXCLI_MEDIA_KEYS !== "0" ? "mpv bridge enabled; physical/system acceptance required" : "off",
    tools };
}
