/** Simple symbols, never font-specific glyphs; opt out on plain terminals. */
export function browseIcon(kind: "video" | "music" | "live" | "queued"): string {
  const plain = process.env.TERM === "dumb" || process.env.JUKEBOXCLI_ICONS === "ascii";
  return ({ video: plain ? ">" : "▶", music: plain ? "M" : "♫", live: plain ? "*" : "●", queued: plain ? "+" : "✓" })[kind];
}

/** Recognisable emoji icons; Sidebar reserves a fixed column for wide glyphs. */
export function navigationIcon(section: "home" | "library" | "playlists" | "history" | "download" | "settings" | "player" | "queue" | "discover" | "listen" | "videos"): string {
  const plain = process.env.TERM === "dumb" || process.env.JUKEBOXCLI_ICONS === "ascii";
  const symbols = {
    home: ["🏠", "H"], library: ["📚", "L"], playlists: ["📋", "="],
    history: ["🕘", "~"], download: ["📥", "v"], settings: ["🔧", "*"],
    player: ["🎵", ">"], queue: ["📑", "+"], discover: ["🔎", "M"],
    listen: ["📻", "o"], videos: ["🎬", ">"],
  };
  return symbols[section][plain ? 1 : 0]!;
}
