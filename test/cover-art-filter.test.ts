import { describe, expect, it, vi } from "vitest";
import { coverArtFilter } from "../src/player/art";
import { loadCoverArt, loadSixelImage } from "../src/player/art";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

vi.mock("../src/bin/binaries", () => ({ ffmpegPath: () => "ffmpeg" }));

describe("text cover artwork framing", () => {
  it("centre-crops letterboxed thumbnails before fitting terminal pixels", () => {
    const filter = coverArtFilter(40, 18);
    expect(filter).toContain("crop='min(iw,ih)':'min(iw,ih)'");
    expect(filter.indexOf("crop=")).toBeLessThan(filter.indexOf("scale="));
    expect(filter).toContain("scale=40:36");
    expect(filter).toContain("pad=40:36");
  });

  it.skipIf(spawnSync("ffmpeg", ["-version"]).status !== 0)("preserves both edges of a landscape preview and separates it from square cover caching", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "jukebox-landscape-"));
    const file = path.join(dir, "thumbnail.ppm");
    const pixels = Buffer.alloc(160 * 90 * 3);
    for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
      pixels[(y * 160 + x) * 3 + (x < 25 ? 0 : x >= 135 ? 1 : 2)] = 255;
    }
    writeFileSync(file, Buffer.concat([Buffer.from("P6\n160 90\n255\n"), pixels]));
    try {
      const landscape = await loadCoverArt(file, 32, 9, "contain");
      expect(landscape?.cells[0]?.top[0]).toBeGreaterThan(200);
      expect(landscape?.cells[31]?.top[1]).toBeGreaterThan(200);
      const square = await loadCoverArt(file, 32, 9);
      expect(square?.cells[0]?.top[0]).toBeLessThan(50);
      expect(square?.cells[31]?.top[1]).toBeLessThan(50);
      const sixel = await loadSixelImage(file, 32, 18, "contain");
      expect(sixel?.sixel).toContain(";2;100;0;0"); // Red left edge remains in the adaptive palette.
      expect(sixel?.sixel).toContain(";2;0;100;0"); // Green right edge.
      const croppedSixel = await loadSixelImage(file, 32, 18);
      expect(croppedSixel?.sixel).not.toContain(";2;100;0;0");
      expect(croppedSixel?.sixel).not.toContain(";2;0;100;0");
      const again = await loadCoverArt(file, 32, 9, "contain");
      expect(again?.cells[0]?.top[0]).toBeGreaterThan(200);
      expect(again?.cells[31]?.top[1]).toBeGreaterThan(200);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
