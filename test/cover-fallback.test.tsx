import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { Text } from "ink";
import { Cover } from "../src/ui/components/Cover";
import { loadCoverArt } from "../src/player/art";
vi.mock("../src/player/art", () => ({ loadCoverArt: vi.fn(async (source: string) => source === "good" ? {
  rows: 1, cols: 1, cells: [{ top: [255, 0, 0], bottom: [0, 0, 255] }],
} : null) }));
beforeEach(() => { vi.stubEnv("TERM_PROGRAM", "unknown"); vi.stubEnv("JUKEBOXCLI_ART", ""); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it("uses the native Terminal drawing without extracting art, and honours block opt-in", async () => {
  vi.stubEnv("TERM_PROGRAM", "Apple_Terminal");
  const node = (visible = true) => <Cover source="good" visible={visible} cols={28} rows={8} fallback={<Text>Disc display</Text>} />;
  const view = render(node());
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Disc display"));
  expect(loadCoverArt).not.toHaveBeenCalled();
  expect(view.lastFrame()).not.toContain("▀");
  vi.stubEnv("JUKEBOXCLI_ART", "blocks");
  view.rerender(node());
  await vi.waitFor(() => expect(view.lastFrame()).toContain("▀"));
  vi.stubEnv("JUKEBOXCLI_ART", "simple");
  view.rerender(node());
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Disc display"));
  expect(view.lastFrame()).not.toContain("▀");
  view.rerender(node(false));
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Artwork hidden"));
  expect(view.lastFrame()).not.toContain("Disc display");
});
it("keeps real art ahead of the fallback and clears it when source changes or is hidden", async () => {
  const node = (source?: string, visible = true) => <Cover source={source} visible={visible} cols={28} rows={8} fallback={<Text>Station display</Text>} />;
  const view = render(node("good")); await new Promise(r => setTimeout(r, 30));
  expect(view.lastFrame()).toContain("▀"); expect(view.lastFrame()).not.toContain("Station display");
  view.rerender(node("missing")); await new Promise(r => setTimeout(r, 30));
  expect(view.lastFrame()).toContain("Station display"); expect(view.lastFrame()).not.toContain("▀");
  view.rerender(node(undefined, false)); await new Promise(r => setTimeout(r, 30));
  expect(view.lastFrame()).toContain("Artwork hidden"); expect(view.lastFrame()).not.toContain("Station display");
});
