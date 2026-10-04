import { expect, it, vi } from "vitest";
import { genreFromProbe, scanGenres } from "../src/library/genre";
import { libraryCollections } from "../src/library/browse";
import { Library } from "../src/library/library";
import type { Track } from "../src/library/types";
const track = (id: string, genre?: string): Track => ({ id, genre, title: id, source: "local", sourceTrackId: id, filePath: `/music/${id}.mp3`, addedAt: "2026-01-01" });
it("reads case-insensitive genre tags and ignores missing/non-string data", () => {
  expect(genreFromProbe('{"format":{"tags":{"GENRE":" House\\n "}}}')).toBe("House");
  expect(genreFromProbe('{"format":{"tags":{"genre":12}}}')).toBeUndefined();
  expect(genreFromProbe("{}")).toBeUndefined();
});
it("groups genres case-insensitively and retains unknown tracks", () => {
  const groups = libraryCollections([track("1", "House"), track("2", " house "), track("3")], "genres");
  expect(groups.map(g => g.title)).toEqual(["House", "Unknown genre"]);
  expect(groups[0]!.tracks).toHaveLength(2);
});
it("updates only the index, preserves concurrent edits and reports failures", async () => {
  const lib = Library.empty(); await lib.upsertMany([track("1"), track("2", "Jazz"), track("3")]);
  const probe = vi.fn(async (file: string) => {
    if (file.endsWith("1.mp3")) { await lib.upsert({ ...lib.get("1")!, title: "Renamed" }); return "House"; }
    if (file.endsWith("2.mp3")) return undefined;
    throw Error("bad file");
  });
  const result = await scanGenres(lib, new AbortController().signal, vi.fn(), probe);
  expect(result).toEqual({ checked: 3, updated: 1, failed: 1, total: 3 });
  expect(lib.get("1")).toMatchObject({ genre: "House", title: "Renamed" });
  expect(lib.get("2")!.genre).toBe("Jazz");
  expect(lib.search("House").map(t => t.id)).toEqual(["1"]);
});
it("stops on cancellation and never recreates removed tracks", async () => {
  const lib = Library.empty(); await lib.upsertMany([track("1"), track("2")]);
  const abort = new AbortController();
  const probe = vi.fn(async () => { await lib.remove("1"); abort.abort(); return "House"; });
  const result = await scanGenres(lib, abort.signal, vi.fn(), probe);
  expect(probe).toHaveBeenCalledTimes(1); expect(result.updated).toBe(0); expect(lib.get("1")).toBeUndefined();
});
