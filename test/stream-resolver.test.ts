import { describe, expect, it } from "vitest";
import { resolvedMedia } from "../src/player/resolve";
import { musicResult } from "../src/sources/music";
import { streamMetadata } from "../src/player/media";

describe("stream boundaries", () => {
  it("bounds URL lifetime and drops credentials and header injection", () => {
    const media = resolvedMedia({ url: "https://cdn.example/audio?expire=1000", http_headers: {
      "User-Agent": "test", Cookie: "secret", Authorization: "secret", Referer: "bad\r\nheader" } }, 500_000);
    expect(media.expiresAt).toBe(800_000); expect(media.headers).toEqual({ "User-Agent": "test" });
    expect(() => resolvedMedia({ url: "file:///private/file" })).toThrow();
  });
  it("normalises Music search metadata without pretending a stream is a saved file", () => {
    const item = musicResult({ id: "abc", item_type: "song", title: "Title", artists: [{ name: "Artist" }], duration: { seconds: 123 } })!;
    expect(item.track?.filePath).toBeUndefined(); expect(item.track?.artist).toBe("Artist");
    expect(item.track?.streamUrl).toContain("music.youtube.com/watch?v=abc");
    const saved = streamMetadata({ ...item.track!, directUrl: "secret" } as any);
    expect(saved).not.toHaveProperty("directUrl"); expect(musicResult({})).toBeNull();
  });
});
