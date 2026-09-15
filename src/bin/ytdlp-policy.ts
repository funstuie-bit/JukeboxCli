export type YtDlpProvider = "system" | "managed";

/** A yt-dlp-only preference: never changes mpv/FFmpeg ownership. */
export function ytDlpProvider(preference?: YtDlpProvider, env: NodeJS.ProcessEnv = process.env): YtDlpProvider {
  return preference === "managed" || preference === "system" ? preference
    : env.JUKEBOXCLI_SYSTEM_TOOLS === "1" ? "system" : "managed";
}
