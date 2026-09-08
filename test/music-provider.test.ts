import { describe, it, expect } from "vitest";
import { musicResult, searchPage } from "../src/sources/music";

const raw = { item_type: "song", id: "video", title: "Song", artists: [{ name: "Artist" }],
  duration: { seconds: 120 }, thumbnails: [{ url: "https://example.com/cover.jpg" }] };
describe("YouTube Music boundary", () => {
  it("normalises a stream without pretending it is a local file", () => {
    const item = musicResult(raw)!;
    expect(item.track?.streamUrl).toBe("https://music.youtube.com/watch?v=video");
    expect(item.track?.filePath).toBeUndefined(); expect(item.track?.artist).toBe("Artist");
    expect(musicResult(null)).toBeNull(); expect(musicResult({ title: "no identity" })).toBeNull();
  });
  it("handles the distinct first-page and continuation shelf shapes", async () => {
    const page = searchPage({ contents: [{ contents: [raw] }], has_continuation: true,
      getContinuation: async () => ({ contents: { contents: [{ ...raw, id: "next" }] }, has_continuation: false }) }, "song", "query");
    expect(page.items[0]?.id).toBe("video");
    const next = await page.more!(); expect(next.items[0]?.id).toBe("next"); expect(next.more).toBeUndefined();
  });
  it("keeps album browse identities distinct from playable songs", () => {
    const album = musicResult({ item_type: "album", title: "Album", endpoint: { payload: { browseId: "MPRE" } } });
    expect(album?.id).toBe("MPRE"); expect(album?.track).toBeUndefined();
  });
});
