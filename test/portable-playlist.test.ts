import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { paths } from "../src/config/paths";
import { decodePlaylist, encodePlaylist, writePlaylist, readPlaylist } from "../src/library/portable-playlist";
import { trackFromUrl } from "../src/player/url";
import type { Track } from "../src/library/types";
const track = (root: string): Track => ({ id: "a", title: "Song", artist: "Artist", source: "local", sourceTrackId: "a", filePath: `${root}/Album/a.mp3`, addedAt: "2026-01-01" });
it.each(["json", "m3u"] as const)("round-trips ordered mixed queues across music roots (%s)", format => {
  const radio = { ...trackFromUrl("https://example.com/radio", true), title: "Station" };
  const youtube = trackFromUrl("https://youtube.com/watch?v=dQw4w9WgXcQ");
  const { content } = encodePlaylist([track("/old/music"), radio, youtube, radio], "/old/music", format);
  expect(content).not.toContain("/old/music");
  const result = decodePlaylist(content, [track("/new/music")], "/new/music");
  expect(result).toMatchObject({ missing: 0, invalid: 0, total: 4 });
  expect(result.tracks.map(t => t.title)).toEqual(["Song", "Station", youtube.title, "Station"]);
  expect(result.tracks[1]).toMatchObject({ streamType: "radio", isLive: true });
  expect(result.tracks[2]).toMatchObject({ streamType: "extractor", source: "youtube" });
});
it("reports missing files and rejects traversal, credentials and command schemes", () => {
  const content = JSON.stringify({ format: "jukeboxcli-playlist", version: 1, entries: [
    { kind: "local", path: "missing.mp3" }, { kind: "local", path: "../secret" },
    { kind: "local", path: "/etc/passwd" }, { kind: "local", path: "C:\\secret" },
    { kind: "stream", url: "file:///etc/passwd" }, { kind: "stream", url: "https://user:pass@example.com" },
    { kind: "stream", url: "https://example.com/stream", type: "shell" }, null,
  ] });
  expect(decodePlaylist(content, [], "/music")).toEqual({ tracks: [], missing: 1, invalid: 7, total: 8 });
});
it("does not leak outside-library paths and strips line injection", () => {
  const { content, omitted } = encodePlaylist([track("/private"), { ...track("/music"), title: "Song\n#EXTINF:bad" }], "/music", "m3u");
  expect(omitted).toBe(1); expect(content).not.toContain("/private"); expect(content).not.toContain("\n#EXTINF:bad");
});
it("rejects oversized and unsupported documents", () => {
  expect(() => decodePlaylist("a".repeat(2097153), [], "/music")).toThrow("2 MB");
  expect(() => decodePlaylist('{"version":2}', [], "/music")).toThrow("Unsupported");
  expect(() => decodePlaylist("https://example.com", [], "/music")).toThrow("extended M3U");
});
it("writes private files exclusively and reads the result", async () => {
  await fs.mkdir(paths.temp, { recursive: true });
  const file = path.join(paths.temp, "playlist.json");
  await writePlaylist(file, [track("/music")], "/music");
  await expect(writePlaylist(file, [], "/music")).rejects.toThrow();
  expect((await fs.stat(file)).mode & 0o777).toBe(0o600);
  expect((await readPlaylist(file, [], "/music")).missing).toBe(1);
});
