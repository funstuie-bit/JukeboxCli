import { expect, it, vi } from "vitest";
import { renderReady, act } from "./ink-input";
import { Cover } from "../src/ui/components/Cover";
const fixture = vi.hoisted(() => ({ remove: vi.fn(), set: vi.fn(), blocks: vi.fn() }));
vi.mock("../src/player/graphics", () => ({
  graphicsPainter: { set: fixture.set, paint: vi.fn() }, graphicsProtocol: "kitty", cellAspect: .5,
  simpleArtwork: () => false,
}));
vi.mock("../src/player/art", () => ({
  loadCoverImage: async () => ({ width: 10, height: 10 }),
  loadCoverArt: fixture.blocks,
}));
it("uses block artwork under a popup and restores native image rendering after closing", async () => {
  fixture.set.mockReturnValue(fixture.remove);
  fixture.blocks.mockResolvedValue({ rows: 1, cols: 1, cells: [{ top: [255, 0, 0], bottom: [0, 0, 0] }] });
  const node = (overlay: boolean) => <Cover source="fixture" cols={10} rows={5} visible suppressGraphics={overlay} />;
  const view = await renderReady(node(false));
  expect(fixture.set).toHaveBeenCalledOnce();
  await act(async () => { view.rerender(node(true)); });
  expect(fixture.remove).toHaveBeenCalledOnce();
  expect(view.lastFrame()).toContain("▀");
  await act(async () => { view.rerender(node(false)); });
  expect(fixture.set).toHaveBeenCalledTimes(2);
});
