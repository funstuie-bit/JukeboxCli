import { describe, expect, it } from "vitest";
import { coverArtFilter } from "../src/player/art";

describe("text cover artwork framing", () => {
  it("centre-crops letterboxed thumbnails before fitting terminal pixels", () => {
    const filter = coverArtFilter(40, 18);
    expect(filter).toContain("crop='min(iw,ih)':'min(iw,ih)'");
    expect(filter.indexOf("crop=")).toBeLessThan(filter.indexOf("scale="));
    expect(filter).toContain("scale=40:36");
    expect(filter).toContain("pad=40:36");
  });
});
