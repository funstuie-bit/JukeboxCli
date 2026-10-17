import { expect, it, vi } from "vitest";
import { Home } from "../src/ui/sections/Home";
import { StoreContext } from "../src/ui/store";
import { defaultConfig } from "../src/config/config";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { renderReady, act } from "./ink-input";

const fixture = vi.hoisted(() => ({ remove: vi.fn(), set: vi.fn(), blocks: vi.fn(), images: vi.fn() }));
vi.mock("../src/player/graphics", () => ({
  graphicsPainter: { set: fixture.set, paint: vi.fn() }, graphicsProtocol: "kitty",
  cellAspect: .5, simpleArtwork: () => false,
}));
vi.mock("../src/player/art", () => ({ loadCoverImage: fixture.images, loadCoverArt: fixture.blocks }));
vi.mock("../src/player/stations", async original => ({
  ...await original<typeof import("../src/player/stations")>(),
  readStations: () => [{ name: "Fixture Radio", url: "https://example.com/radio.mp3", thumbnailUrl: "https://example.com/radio.png" }],
}));

it("shows recent and station tiles together while reserving native graphics for the featured cover", async () => {
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
  const recent = store.library.all()[0]!;
  store.history.record(recent);
  const node = (hidden = false) => <StoreContext.Provider value={{ ...store, region: hidden ? "help" : "content" }}><Home /></StoreContext.Provider>;
  const view = await renderReady(node(), store.cols);

  expect(view.lastFrame()).toContain("Recent ·");
  expect(view.lastFrame()).toContain("Fixture Radio");
  expect(fixture.blocks).toHaveBeenCalledWith(recent.filePath, 8, 4, "cover");
  expect(fixture.blocks).toHaveBeenCalledWith("https://example.com/radio.png", 8, 4, "cover");
  expect(view.lastFrame()!.match(/▀/g)).toHaveLength(64);
  expect(fixture.images).toHaveBeenCalledExactlyOnceWith(recent.filePath, 1024);
  expect(fixture.set).toHaveBeenCalledOnce();

  await act(async () => { view.rerender(node(true)); });
  expect(fixture.remove).toHaveBeenCalledOnce();
  expect(view.lastFrame()).not.toContain("▀");
});
