import { afterEach, expect, it, vi } from "vitest";
import type { render } from "ink-testing-library";
import { press, renderReady } from "./ink-input";
import { makeStore } from "../scripts/fake-data";
import { StoreContext } from "../src/ui/store";
import { Settings } from "../src/ui/sections/Settings";
import { installMacVisualizer } from "../src/player/macos-visualizer-install";

vi.mock("../src/player/macos-visualizer-install", () => ({
  installMacVisualizer: vi.fn(), macVisualizerSupported: () => true,
}));
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); });
const waitForFrame = async (view: ReturnType<typeof render>, text: string) => {
  await vi.waitFor(() => expect(view.lastFrame()).toContain(text), { timeout: 3000 });
};

it("requires confirmation and keeps hooks stable across the Mac installer page", async () => {
  vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
  vi.mocked(installMacVisualizer).mockImplementation(async progress => { progress?.("Pack installed."); });
  const view = await renderReady(<StoreContext.Provider value={makeStore({ region: "content", listRows: 30 })}><Settings /></StoreContext.Provider>);
  await waitForFrame(view, "❯ YouTube handle");
  await press(view, "\u001b[F");
  for (let i = 0; i < 20 && !view.lastFrame()?.includes("❯ Player appearance"); i++) await press(view, "\u001b[A");
  await waitForFrame(view, "❯ Player appearance");
  await press(view, "\r");
  await waitForFrame(view, "❯ Theme:");
  for (const label of ["Artwork colours:", "Reduced motion:", "Visualizer:", "Fullscreen effects:", "Install Mac fullscreen pack"]) {
    await press(view, "\u001b[B");
    await waitForFrame(view, `❯ ${label}`);
  }
  await press(view, "\r");
  await waitForFrame(view, "Download and install this optional pack?");
  expect(installMacVisualizer).not.toHaveBeenCalled();
  await press(view, "\u001b[B");
  await waitForFrame(view, "❯ Install / repair");
  await press(view, "\r");
  await vi.waitFor(() => expect(installMacVisualizer).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Pack installed."));
  await waitForFrame(view, "❯ Back");
  await press(view, "\u001b");
  await waitForFrame(view, "Player appearance");
});
