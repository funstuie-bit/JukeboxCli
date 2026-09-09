import { afterEach, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { Text } from "ink";
import { Cover } from "../src/ui/components/Cover";
vi.mock("../src/player/art", () => ({ loadCoverArt: async (source: string) => source === "good" ? {
  rows: 1, cols: 1, cells: [{ top: [255, 0, 0], bottom: [0, 0, 255] }],
} : null }));
afterEach(cleanup);
it("keeps real art ahead of the fallback and clears it when source changes or is hidden", async () => {
  const node = (source?: string, visible = true) => <Cover source={source} visible={visible} cols={28} rows={8} fallback={<Text>Station display</Text>} />;
  const view = render(node("good")); await new Promise(r => setTimeout(r, 30));
  expect(view.lastFrame()).toContain("▀"); expect(view.lastFrame()).not.toContain("Station display");
  view.rerender(node("missing")); await new Promise(r => setTimeout(r, 30));
  expect(view.lastFrame()).toContain("Station display"); expect(view.lastFrame()).not.toContain("▀");
  view.rerender(node(undefined, false)); await new Promise(r => setTimeout(r, 30));
  expect(view.lastFrame()).toContain("Artwork hidden"); expect(view.lastFrame()).not.toContain("Station display");
});
