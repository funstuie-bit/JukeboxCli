import { expect, it, vi } from "vitest";
import { Home } from "../src/ui/sections/Home";
import { StoreContext } from "../src/ui/store";
import { defaultConfig } from "../src/config/config";
import { makeStore, makeFakePlayback, makeFakeLibrary } from "../scripts/fake-data";
import { renderReady, act } from "./ink-input";

const fixture = vi.hoisted(() => ({ native: true, remove: vi.fn(), set: vi.fn(), blocks: vi.fn(), images: vi.fn() }));
vi.mock("../src/player/graphics", () => ({
  get graphicsPainter() { return fixture.native ? { set: fixture.set, paint: vi.fn(), repaintSixel: vi.fn() } : undefined; }, graphicsProtocol: "kitty",
  cellAspect: .5, simpleArtwork: () => false,
}));
vi.mock("../src/player/art", () => ({ loadCoverImage: fixture.images, loadCoverArt: fixture.blocks }));
vi.mock("../src/player/stations", async original => ({
  ...await original<typeof import("../src/player/stations")>(),
  readStations: () => [{ name: "Fixture Radio", url: "https://example.com/radio.mp3", thumbnailUrl: "https://example.com/radio.png" }],
}));

it.each([
  [true, "Short title"],
  [true, "A very long stream title that must truncate instead of squeezing its adjacent artwork with many extra words"],
  [false, "Short title"],
  [false, "A very long stream title that must truncate instead of squeezing its adjacent artwork with many extra words"],
] as const)("keeps Home thumbnails in their own boxes with native=%s and %s", async (native, title) => {
  vi.clearAllMocks();
  fixture.native = native;
  fixture.set.mockReturnValue(fixture.remove);
  fixture.images.mockResolvedValue({ width: 80, height: 80, png: new Uint8Array([1]) });
  fixture.blocks.mockImplementation(async (_source: string, cols: number, rows: number) => ({
    cols, rows, brightness: .5,
    cells: Array.from({ length: cols * rows }, () => ({ top: [120, 80, 200], bottom: [60, 40, 120] })),
  }));
  const store = makeStore({
    cols: 154, contentWidth: 124, listRows: 44, section: "home", region: "content",
    config: { ...defaultConfig, artworkColours: false, reducedMotion: true },
    playback: makeFakePlayback({ track: null, list: [], paused: true }),
  });
  const recent = { ...store.library.all()[0]!, title };
  store.library = makeFakeLibrary([recent]);
  store.history.record(recent);
  const node = (hidden = false) => <StoreContext.Provider value={{ ...store, region: hidden ? "help" : "content" }}><Home /></StoreContext.Provider>;
  const view = await renderReady(node(), store.cols);

  expect(view.lastFrame()).toContain("Recent ·");
  expect(view.lastFrame()).toContain("Fixture Radio");
  const lines = view.lastFrame()!.split("\n");
  const heading = lines.findIndex(line => line.includes("RECENT LISTENING"));
  if (native) {
    expect(fixture.blocks).not.toHaveBeenCalled();
    expect(fixture.images).toHaveBeenCalledTimes(3);
    expect(fixture.set).toHaveBeenCalledTimes(3);
    const tileRects = fixture.set.mock.calls.map(call => call[1]()).filter(rect => rect.rows === 4);
    expect(tileRects).toHaveLength(2);
    expect(tileRects.every(rect => rect.cols === 8 && rect.y > heading)).toBe(true);
  } else {
    expect(fixture.blocks).toHaveBeenCalledWith(recent.filePath, 8, 4, "cover");
    expect(fixture.blocks).toHaveBeenCalledWith("https://example.com/radio.png", 8, 4, "cover");
    const artworkRows = lines.map((line, y) => ({ line, y })).filter(row => row.y > heading && row.line.includes("▀"));
    expect(artworkRows).toHaveLength(4);
    expect(artworkRows.map(row => row.line.match(/▀/g)?.length)).toEqual([16, 16, 16, 16]);
    expect(fixture.set).not.toHaveBeenCalled();
  }

  await act(async () => { view.rerender(node(true)); });
  expect(fixture.remove).toHaveBeenCalledTimes(native ? 3 : 0);
  expect(view.lastFrame()).not.toContain("▀");
});
