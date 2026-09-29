import { describe, expect, it } from "vitest";
import { libraryCollections } from "../src/library/browse";
import type { Track } from "../src/library/types";

function track(id: string, artist?: string, album?: string): Track {
  return { id, source: "local", sourceTrackId: id, title: id, artist, album, filePath: `/music/${id}.mp3`, addedAt: "2026-01-01" };
}

describe("library collections", () => {
  it("sorts artist names, retains track order and does not mutate metadata", () => {
    const tracks = [track("1", "Zulu"), track("2", " Alpha "), track("3", "Alpha")];
    const groups = libraryCollections(tracks, "artists");
    expect(groups.map(g => g.title)).toEqual(["Alpha", "Zulu"]);
    expect(groups[0]!.tracks.map(t => t.id)).toEqual(["2", "3"]);
    expect(tracks[1]!.artist).toBe(" Alpha ");
  });
  it("keeps identically named albums by different artists separate", () => {
    const groups = libraryCollections([track("1", "A", "Hits"), track("2", "B", "Hits"), track("3", "A", "Hits")], "albums");
    expect(groups).toHaveLength(2);
    expect(groups[0]!.tracks.map(t => t.id)).toEqual(["1", "3"]);
    expect(groups[0]!.id).not.toBe(groups[1]!.id);
  });
  it("keeps untagged files browsable and supports an empty library", () => {
    expect(libraryCollections([track("1", " ")], "artists")[0]!.title).toBe("Unknown artist");
    expect(libraryCollections([track("1")], "albums")[0]!.title).toBe("Unknown album");
    expect(libraryCollections([], "albums")).toEqual([]);
  });
});
