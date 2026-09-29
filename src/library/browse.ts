import type { Track } from "./types";

export type BrowseMode = "songs" | "artists" | "albums";
export interface LibraryCollection {
  id: string;
  title: string;
  artist?: string;
  tracks: Track[];
}

/** Group existing metadata without moving files or changing playlist ownership. */
export function libraryCollections(tracks: readonly Track[], mode: Exclude<BrowseMode, "songs">): LibraryCollection[] {
  const groups = new Map<string, LibraryCollection>();
  for (const track of tracks) {
    const artist = track.artist?.trim() || "Unknown artist";
    const album = track.album?.trim() || "Unknown album";
    // Album names alone are not unique (e.g. Greatest Hits).
    const id = JSON.stringify(mode === "artists" ? [artist] : [artist, album]);
    let group = groups.get(id);
    if (!group) {
      group = { id, title: mode === "artists" ? artist : album,
        artist: mode === "albums" ? artist : undefined, tracks: [] };
      groups.set(id, group);
    }
    group.tracks.push(track);
  }
  return [...groups.values()].sort((a, b) => a.title.localeCompare(b.title) || (a.artist ?? "").localeCompare(b.artist ?? ""));
}
