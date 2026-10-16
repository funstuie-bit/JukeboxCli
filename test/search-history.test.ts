import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { SearchHistory } from "../src/sources/search-history";
import { trackFromUrl } from "../src/player/url";
import type { MusicPage } from "../src/sources/music";

const file = () => path.join(mkdtempSync(path.join(os.tmpdir(), "jukebox-search-")), "history.json");
const page = (count = 2): MusicPage => ({ title: "Results", items: Array.from({ length: count }, (_, i) => ({
  id: String(i), kind: "video", title: `Video ${i}`, track: { ...trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk"),
    title: `Video ${i}`, artist: "Channel", thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", durationSec: 123 },
})), more: async () => page() });

it("restores independent catalogues and selection from disk without provider callbacks or media credentials", () => {
  const target = file(); const history = new SearchHistory(target);
  const results = page();
  Object.assign(results.items[0]!.track!, { streamUrl: "https://secret.example/signed?token=PRIVATE", headers: { Cookie: "PRIVATE" }, arbitrary: "PRIVATE" });
  history.record(true, "videos", "video", results); history.rememberCursor(true, "videos", "video", 1);
  history.record(false, "albums", "album", { title: "Albums", items: [{ id: "MPRE123", kind: "album", title: "Album" }] });
  const restored = new SearchHistory(target);
  expect(restored.last(true)).toMatchObject({ query: "videos", cursor: 1, page: { items: [{ track: { streamUrl: "https://www.youtube.com/watch?v=abcdefghijk" } }, {}] } });
  expect(restored.last(true)?.page.more).toBeUndefined();
  expect(restored.recent(false)).toEqual([{ query: "albums", kind: "album" }]);
  expect(readFileSync(target, "utf8")).not.toContain("PRIVATE");
  expect(statSync(target).mode & 0o777).toBe(0o600);
  restored.clear(true);
  expect(new SearchHistory(target).last(true)).toBeUndefined();
  expect(new SearchHistory(target).last(false)?.page.items[0]?.title).toBe("Album");
});

it("bounds results and recents, deduplicates query/type and isolates different profiles", () => {
  const target = file(); const history = new SearchHistory(target);
  for (let i = 0; i < 40; i++) history.record(true, `query ${i}`, "video", page(120));
  history.record(true, "query 35", "video", page(120));
  history.rememberCursor(true, "query 35", "video", 900);
  const restored = new SearchHistory(target);
  expect(restored.recent(true)).toHaveLength(30);
  expect(restored.recent(true)[0]?.query).toBe("query 35");
  expect(restored.recent(true).filter(s => s.query === "query 35")).toHaveLength(1);
  expect(restored.last(true)?.page.items).toHaveLength(100);
  expect(restored.last(true)?.cursor).toBe(99);
  expect(new SearchHistory(file()).recent(true)).toEqual([]);
});

it("ignores corrupt/oversized/unsupported files and strips invalid rows and artwork", () => {
  const target = file();
  for (const data of ["{", "x".repeat(1024 * 1024 + 1), '{"version":99}']) {
    writeFileSync(target, data); expect(new SearchHistory(target).recent(true)).toEqual([]);
  }
  const history = new SearchHistory(target); const results = page();
  results.items[0]!.track!.thumbnailUrl = "https://user:password@i.ytimg.com/image.jpg";
  results.items[1]!.track!.sourceTrackId = 12345678901 as unknown as string;
  history.record(true, "valid", "video", results);
  expect(new SearchHistory(target).last(true)?.page.items).toHaveLength(1);
  expect(new SearchHistory(target).last(true)?.page.items[0]?.track?.thumbnailUrl).toBeUndefined();
  mkdirSync(`${target}.directory`);
  const unavailable = new SearchHistory(`${target}.directory`);
  unavailable.record(true, "still searchable", "video", page());
  expect(unavailable.error).toContain("Could not save");
  expect(unavailable.recent(true)).toHaveLength(1);
});

it("keeps long Unicode metadata within the readable file limit", () => {
  const target = file(); const history = new SearchHistory(target);
  const results = page(100);
  for (const item of results.items) {
    item.title = "音".repeat(500); item.subtitle = "音".repeat(1000);
    item.track!.artist = "音".repeat(500); item.track!.album = "音".repeat(500);
  }
  history.record(true, "Unicode videos", "video", results);
  history.record(false, "Unicode music", "song", results);
  expect(statSync(target).size).toBeLessThanOrEqual(1024 * 1024);
  expect(new SearchHistory(target).last(true)?.page.items.length).toBeGreaterThan(0);
  expect(new SearchHistory(target).recent(false)[0]?.query).toBe("Unicode music");
});
