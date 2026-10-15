/** Simple symbols, never font-specific glyphs; opt out on plain terminals. */
export function browseIcon(kind: "video" | "music" | "live" | "queued"): string {
  const plain = process.env.TERM === "dumb" || process.env.JUKEBOXCLI_ICONS === "ascii";
  return ({ video: plain ? ">" : "▶", music: plain ? "M" : "♫", live: plain ? "*" : "●", queued: plain ? "+" : "✓" })[kind];
}
