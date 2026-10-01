import { describe, expect, it, vi } from "vitest";
import { discoverFeeds } from "../src/player/feeds";
import { studayFmFeeds } from "../src/player/studayfm";

describe("Studay FM public presets", () => {
  it.each(["https://studayfm.com", "https://www.studayfm.com/", "http://studayfm.com/?from=jukebox"])("finds all five from %s without fetching scripts or audio", async url => {
    const fetcher = vi.fn();
    const result = await discoverFeeds(url, false, new AbortController().signal, fetcher);
    expect(result.tracks.map(t => t.title)).toEqual(["Studay FM", "StuLoFiDay", "Yacht Zone", "Tokyo Jazz", "C'est Magnifistu"]);
    expect(new Set(result.tracks.map(t => t.id)).size).toBe(5);
    for (const t of result.tracks) {
      expect(t.streamType).toBe("radio"); expect(t.isLive).toBe(true);
      expect(t.streamUrl).toMatch(/^https:\/\/www\.studayfm\.com\//);
      expect(t.thumbnailUrl).toMatch(/^https:\/\/www\.studayfm\.com\/images\//);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(["stream", "lofi", "yacht", "jazzhop", "cest-magnifistu"])("names and canonicalises direct %s feeds", mount => {
    const direct = studayFmFeeds(new URL(`https://studayfm.com/${mount}/`))!;
    expect(direct).toHaveLength(1);
    expect(direct[0]!.streamUrl).toBe(`https://www.studayfm.com/${mount}`);
    const matching = studayFmFeeds(new URL("https://www.studayfm.com"))!.find(t => t.streamUrl === direct[0]!.streamUrl);
    expect(direct[0]!.id).toBe(matching!.id);
  });
  it("does not recognise lookalike hosts, private paths or nonstandard ports", () => {
    for (const url of ["https://studayfm.com.example.com", "https://other.example/lofi", "https://studayfm.com/admin", "https://studayfm.com:8443/"]) {
      expect(studayFmFeeds(new URL(url))).toBeUndefined();
    }
  });
  it("honours cancellation before returning presets", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(discoverFeeds("https://studayfm.com", true, controller.signal, vi.fn())).rejects.toThrow();
  });
});
