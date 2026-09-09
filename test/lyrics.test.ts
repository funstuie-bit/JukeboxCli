import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLyricsService, parseLrc, lyricIndex, lyricsSignature } from "../src/player/lyrics";
import { trackFromUrl } from "../src/player/url";

const song = { ...trackFromUrl("https://example.com/audio.mp3"), title: "Fixture Song", artist: "Fixture Artist", durationSec: 30 };
const record = { trackName: song.title, artistName: song.artist, duration: 30, instrumental: false,
  syncedLyrics: "[00:00.00] First fixture line\n[00:10.00] Second fixture line", plainLyrics: "First fixture line\nSecond fixture line" };
const options = (online = true) => ({ online, signal: new AbortController().signal });
const cacheFile = () => path.join(mkdtempSync(path.join(tmpdir(), "lyrics-test-")), "cache.json");

describe("LRC parsing and timing", () => {
  it("handles repeated timestamps, offsets, fractional precision and empty instrumental gaps", () => {
    const r = parseLrc("\uFEFF[ar:Fixture]\n[offset:-100]\n[00:02.1][00:04.123] line\n[00:03.00]\n[00:01.12]<00:01.12> earlier");
    expect(r.lines).toEqual([{ at: 1.02, text: "earlier" }, { at: 2, text: "line" }, { at: 2.9, text: "" }, { at: 4.023, text: "line" }]);
    expect(lyricIndex(r.lines, 0)).toBe(-1); expect(lyricIndex(r.lines, 2.9)).toBe(2); expect(lyricIndex(r.lines, 999)).toBe(3);
  });
  it("supports plain text, sanitises terminal controls and rejects oversized input", () => {
    expect(parseLrc("[ti:Song]\nPlain fixture\n\u001b[31mSafe fixture").plain).toEqual(["Plain fixture", "Safe fixture"]);
    expect(() => parseLrc("x".repeat(65537))).toThrow(/large/);
  });
  it("requires radio artist/title and rejects DJ mixes or ambiguous separators", () => {
    const radio = trackFromUrl("https://example.com/live", true);
    expect(lyricsSignature(radio, "Artist - Song")).toMatchObject({ artist: "Artist", title: "Song" });
    for (const title of [undefined, "Artist", "DJ - Late Night Mix", "mixed by Lars - set", "Artist - Song - Station"])
      expect(lyricsSignature(radio, title)).toBeNull();
    expect(lyricsSignature({ ...song, artist: undefined })).toBeNull();
  });
});

describe("lyrics service", () => {
  it("reads adjacent LRC first without provider requests or writing beside music", async () => {
    const file = cacheFile(); const audio = path.join(path.dirname(file), "song.mp3");
    writeFileSync(audio.replace(".mp3", ".lrc"), "[00:01] Local fixture");
    const fetcher = vi.fn(); const service = createLyricsService({ fetcher, cacheFile: file });
    const local = { id: "local", source: "local" as const, sourceTrackId: "local", addedAt: "2026-09-08", title: "song", filePath: audio };
    expect((await service(local, options(false))).lyrics).toMatchObject({ source: "Local LRC", lines: [{ at: 1, text: "Local fixture" }] });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("does not send any network request before opt-in", async () => {
    const fetcher = vi.fn(); const service = createLyricsService({ fetcher, cacheFile: cacheFile() });
    expect((await service(song, options(false))).message).toContain("L enables");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("identifies client, uses exact metadata, caches privately and reopens offline", async () => {
    const file = cacheFile(); const fetcher = vi.fn(async () => Response.json(record));
    const service = createLyricsService({ fetcher, cacheFile: file, spacing: 0 });
    expect((await service(song, options())).lyrics?.lines).toHaveLength(2);
    const [url, init] = fetcher.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain("track_name=Fixture+Song"); expect(url).toContain("duration=30");
    expect(init.headers).toMatchObject({ "User-Agent": expect.stringContaining("JukeboxCli/") });
    expect(init).toMatchObject({ credentials: "omit", redirect: "error" });
    expect(statSync(file).mode & 0o777).toBe(0o600);
    const offline = createLyricsService({ fetcher: vi.fn(), cacheFile: file });
    expect((await offline(song, options(false))).lyrics?.source).toBe("Cache · LRCLIB");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not accept wrong artist, title or recording duration", async () => {
    for (const patch of [{ artistName: "Other" }, { trackName: "Other" }, { duration: 300 }]) {
      const service = createLyricsService({ cacheFile: cacheFile(), fetcher: async () => Response.json({ ...record, ...patch }), spacing: 0 });
      expect((await service(song, options())).message).toContain("different recording");
    }
  });
  it("supports instrumental and plain-only results", async () => {
    for (const patch of [{ instrumental: true, plainLyrics: "", syncedLyrics: "" }, { syncedLyrics: null }]) {
      const service = createLyricsService({ cacheFile: cacheFile(), fetcher: async () => Response.json({ ...record, ...patch }) });
      expect((await service(song, options())).lyrics).toBeDefined();
    }
  });
  it("honours Retry-After and never automatically retries", async () => {
    let now = 10000;
    const fetcher = vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
    const service = createLyricsService({ fetcher, cacheFile: cacheFile(), now: () => now, spacing: 0 });
    expect((await service(song, options())).message).toContain("rate limited");
    now += 60_000; await service({ ...song, title: "Other" }, options());
    expect(fetcher).toHaveBeenCalledTimes(1);
    now += 61_000; await service(song, options()); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("caches misses briefly and tolerates invalid cache contents", async () => {
    const file = cacheFile(); writeFileSync(file, "broken");
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    const service = createLyricsService({ fetcher, cacheFile: file, spacing: 0 });
    expect((await service(song, options())).message).toContain("unavailable");
    await service(song, options()); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(readFileSync(file, "utf8")).toBe("broken");
  });
  it("bounds responses and rejects cancelled results without writing cache", async () => {
    const oversize = createLyricsService({ cacheFile: cacheFile(), fetcher: async () => new Response("x".repeat(300000)) });
    expect((await oversize(song, options())).lyrics).toBeUndefined();
    const abort = new AbortController();
    const service = createLyricsService({ cacheFile: cacheFile(), fetcher: async () => { abort.abort(); return Response.json(record); } });
    await expect(service(song, { online: true, signal: abort.signal })).rejects.toThrow();
  });
  it("serialises concurrent requests and reuses a just-fetched matching record", async () => {
    const fetcher = vi.fn(async () => { await new Promise(r => setTimeout(r, 15)); return Response.json(record); });
    const service = createLyricsService({ fetcher, cacheFile: cacheFile(), spacing: 0 });
    const results = await Promise.all([service(song, options()), service(song, options())]);
    expect(results.every(r => r.lyrics)).toBe(true); expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
