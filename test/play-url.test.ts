import { describe, expect, it, vi } from "vitest";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { trackFromUrl } from "../src/player/url";
import { readStations, saveStation, removeStation, stationsFile, stationTrack } from "../src/player/stations";
import { createStreamResolver } from "../src/player/resolve";
import { isLive } from "../src/player/media";

describe("Play URL boundaries", () => {
  it.each([
    "https://youtu.be/dQw4w9WgXcQ?si=private", "https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=playlist",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://youtube.com/live/dQw4w9WgXcQ",
  ])("canonicalises a single YouTube item: %s", url => {
    const t = trackFromUrl(url);
    expect(t.streamUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(t.streamType).toBe("extractor"); expect(t.id).toBe("stream:youtube:dQw4w9WgXcQ");
    expect(t.filePath).toBeUndefined();
  });
  it.each(["/tmp/a.mp3", "file:///tmp/a", "ftp://example.com/a", "https://u:secret@example.com/audio",
    "https://youtube.com/playlist?list=abc", "https://youtube.com/watch?v=bad", "https://example.com/a b",
    "https://example.com/a\nb", "https://example.com/list.pls", "https://example.com/list.m3u"])("rejects unsafe/unsupported input: %s", url => {
    expect(() => trackFromUrl(url)).toThrow();
  });
  it("treats hostname lookalikes as direct audio, and labels radio explicitly", () => {
    expect(trackFromUrl("https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ").streamType).toBe("direct");
    const audio = trackFromUrl("https://example.com/audio.mp3?token=private");
    const radio = trackFromUrl("https://example.com/live.m3u8", true);
    expect(audio.title).not.toContain("private"); expect(isLive(audio)).toBe(false);
    expect(isLive(radio)).toBe(true); expect(radio.durationSec).toBeUndefined();
  });
  it("direct/radio resolution is immediate, cancellable and never reads browser cookies", async () => {
    const config = vi.fn(); const resolver = createStreamResolver(config);
    const t = trackFromUrl("https://example.com/live", true);
    expect(await resolver(t, new AbortController().signal)).toEqual({ url: t.streamUrl, expiresAt: Infinity });
    const cancel = new AbortController(); cancel.abort();
    await expect(resolver(t, cancel.signal)).rejects.toThrow();
    expect(config).not.toHaveBeenCalled();
  });
});

describe("radio favourites", () => {
  it("saves, renames by URL, reopens and removes without library persistence", () => {
    expect(readStations()).toEqual([]);
    saveStation("Test FM", "https://example.com/live");
    saveStation("Renamed FM", "https://example.com/live");
    expect(readStations()).toEqual([{ name: "Renamed FM", url: "https://example.com/live" }]);
    expect(stationTrack(readStations()[0]!).streamType).toBe("radio");
    expect(statSync(stationsFile).mode & 0o777).toBe(0o600);
    expect(removeStation("https://example.com/live")).toEqual([]);
    expect(() => saveStation("", "https://example.com/live")).toThrow();
    expect(() => saveStation("YouTube", "https://youtu.be/dQw4w9WgXcQ")).toThrow();
  });
  it("does not overwrite a corrupt favourites file", () => {
    writeFileSync(stationsFile, "broken");
    expect(() => readStations()).toThrow(/invalid/);
    expect(() => saveStation("Test", "https://example.com/live")).toThrow();
    expect(readFileSync(stationsFile, "utf8")).toBe("broken");
  });
});
