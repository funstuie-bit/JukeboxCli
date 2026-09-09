import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLyricsService, parseLrc, lyricIndex, lyricsSignature, lyricTitle, safeLyricMatch } from "../src/player/lyrics";
import { trackFromUrl } from "../src/player/url";

const song = { ...trackFromUrl("https://example.com/audio.mp3"), title: "Fixture Song", artist: "Fixture Artist", durationSec: 30 };
const record = { trackName: song.title, artistName: song.artist, duration: 30, instrumental: false,
  syncedLyrics: "[00:00.00] First fixture line\n[00:10.00] Second fixture line", plainLyrics: "First fixture line\nSecond fixture line" };
const options = (online = true) => ({ online, signal: new AbortController().signal });
const cacheFile = () => path.join(mkdtempSync(path.join(tmpdir(), "lyrics-test-")), "cache.json");

describe("LRC parsing and timing", () => {
  it("preserves genuine word timings and rejects ambiguous or out-of-order word stamps", () => {
    expect(parseLrc("[offset:100]\n[00:01]<00:01> Hello <00:02> world").lines[0]).toEqual({
      at: 1.1, text: "Hello world", words: [{ at: 1.1, text: "Hello" }, { at: 2.1, text: "world" }],
    });
    for (const row of ["[00:01]<00:02> Hello <00:01> world", "[00:01][00:03]<00:01> Hello <00:02> world",
      "[00:01] Prefix <00:01> Hello <00:02> world"]) expect(parseLrc(row).lines[0]?.words).toBeUndefined();
  });
  it("normalises mastering labels but preserves recording versions", () => {
    for (const t of ["Song (Remastered)", "Song - 2014 Remaster", "Song [Remastered 2014]"])
      expect(lyricTitle(t)).toBe("Song");
    for (const t of ["Song (Live)", "Song - Radio Edit", "Song (Remix)", "Song (Acoustic)", "Song (Unplugged)"])
      expect(lyricTitle(t)).toBe(t);
  });
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
  const found = { ...record, id: 1, albumName: "Fixture album" };
  const shaped = { id: 1, title: song.title, artist: song.artist, album: "Fixture album", duration: 30,
    plainLyrics: record.plainLyrics, syncedLyrics: record.syncedLyrics, instrumental: false };
  it("finds remasters with primary artist and duration, then caches under the original tags", async () => {
    const file = cacheFile();
    const tagged = { ...song, title: "Fixture Song (Remastered)", artist: "Fixture Artist, Guest", album: "Edition" };
    const fetcher = vi.fn(async input => {
      const url = new URL(String(input));
      return url.searchParams.has("album_name") ? new Response(null, { status: 404 }) : Response.json(found);
    });
    const service = createLyricsService({ cacheFile: file, fetcher, spacing: 0 });
    expect((await service(tagged, options())).lyrics?.match).toBe("Fixture Artist — Fixture Song");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]![0])).toContain("duration=30");
    expect((await service(tagged, options(false))).lyrics?.source).toBe("Cache · LRCLIB");
  });
  it("requires duration and version compatibility for relaxed automatic matching", () => {
    expect(safeLyricMatch({ title: song.title, artist: song.artist!, duration: 30 }, shaped)).toBe(true);
    for (const patch of [{ duration: undefined }, { duration: 40 }, { title: "Fixture Song (Live)" }, { artist: "Different" }])
      expect(safeLyricMatch({ title: song.title, artist: song.artist!, duration: 30, ...patch }, shaped)).toBe(false);
  });
  it("offers ambiguous results, bounds/deduplicates them and does not cache a guess", async () => {
    const file = cacheFile();
    const fetcher = vi.fn(async input => String(input).includes("/search") ? Response.json([
      found, found, { ...found, id: 2 }, { ...found, id: "bad" }, { ...found, id: 3, duration: null },
    ]) : new Response(null, { status: 404 }));
    const service = createLyricsService({ cacheFile: file, fetcher, spacing: 0 });
    const r = await service(song, options());
    expect(r.lyrics).toBeUndefined(); expect(r.candidates?.map(c => c.id)).toEqual([1, 2]);
    expect((await service(song, options(false))).lyrics).toBeUndefined();
  });
  it("manual selection remembers the original track, keeps wrong versions plain and works offline", async () => {
    const service = createLyricsService({ cacheFile: cacheFile(), fetcher: vi.fn(), spacing: 0 });
    const r = await service(song, { ...options(), candidate: { ...shaped, title: "Fixture Song (Live)", duration: 300 } });
    expect(r.lyrics?.plainOnly).toBe(true);
    expect((await service(song, options(false))).lyrics).toMatchObject({ plainOnly: true, source: "Cache · LRCLIB" });
    expect((await service({ ...song, id: "different", title: "Different" }, options(false))).lyrics).toBeUndefined();
  });
  it("manual search bypasses a cached miss and retry still respects provider cooldown", async () => {
    const fetcher = vi.fn(async input => String(input).includes("q=manual") ? Response.json([found]) : new Response(null, { status: 404 }));
    const service = createLyricsService({ cacheFile: cacheFile(), fetcher, spacing: 0 });
    await service(song, options());
    expect((await service(song, { ...options(), query: "manual" })).candidates).toHaveLength(1);
    await service(song, { ...options(), retry: true }); expect(fetcher).toHaveBeenCalledTimes(5);
    const limited = vi.fn(async () => new Response(null, { status: 429 }));
    const throttled = createLyricsService({ cacheFile: cacheFile(), fetcher: limited, spacing: 0 });
    await throttled(song, options()); await throttled(song, { ...options(), retry: true });
    expect(limited).toHaveBeenCalledTimes(1);
  });
  it("never broadens radio lookup automatically", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    const service = createLyricsService({ cacheFile: cacheFile(), fetcher, spacing: 0 });
    await service(trackFromUrl("https://example.com/live", true), { ...options(), broadcast: "Artist - Song" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("contacts the alternate provider only on explicit online request and caches unverified plain text", async () => {
    const fetcher = vi.fn(async () => Response.json({ lyrics: "Other fixture" }));
    const service = createLyricsService({ cacheFile: cacheFile(), fetcher, spacing: 0 });
    const alternate = { artist: "Artist / Name", title: "Title ?" };
    await service(song, { ...options(false), alternate }); expect(fetcher).not.toHaveBeenCalled();
    const r = await service(song, { ...options(), alternate });
    expect(r.lyrics).toMatchObject({ source: "lyrics.ovh", plainOnly: true, lines: [] });
    expect(String(fetcher.mock.calls[0]![0])).toBe("https://api.lyrics.ovh/v1/Artist%20%2F%20Name/Title%20%3F");
    expect((await service(song, options(false))).lyrics?.source).toBe("Cache · lyrics.ovh");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
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
    expect((await service(song, options(false))).message).toContain("Shift+L to enable");
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
      expect((await service(song, options())).lyrics).toBeUndefined();
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
    await service(song, options()); expect(fetcher).toHaveBeenCalledTimes(2); // exact + search, then cached miss
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
