import { afterEach, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { makeStore } from "../scripts/fake-data";
import { StoreContext } from "../src/ui/store";
import { Settings } from "../src/ui/sections/Settings";
import { installMacVisualizer } from "../src/player/macos-visualizer-install";

vi.mock("../src/player/macos-visualizer-install", () => ({
  installMacVisualizer: vi.fn(), macVisualizerSupported: () => true,
}));
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); });
const waitForFrame = async (view: ReturnType<typeof render>, text: string) => {
  await vi.waitFor(() => expect(view.lastFrame()).toContain(text), { timeout: 3000 });
};

it("requires confirmation and keeps hooks stable across the Mac installer page", async () => {
  vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
  vi.mocked(installMacVisualizer).mockImplementation(async progress => { progress?.("Pack installed."); });
  const view = render(<StoreContext.Provider value={makeStore({ region: "content", listRows: 30 })}><Settings /></StoreContext.Provider>);
  await waitForFrame(view, "❯ YouTube handle");
  view.stdin.write("\u001b[F");
  await waitForFrame(view, "❯ Player appearance");
  view.stdin.write("\r");
  await waitForFrame(view, "❯ Theme:");
  for (const label of ["Reduced motion:", "Visualizer:", "Fullscreen effects:", "Install Mac fullscreen pack"]) {
    view.stdin.write("\u001b[B");
    await waitForFrame(view, `❯ ${label}`);
  }
  view.stdin.write("\r");
  await waitForFrame(view, "Download and install this optional pack?");
  expect(installMacVisualizer).not.toHaveBeenCalled();
  view.stdin.write("\u001b[B");
  await waitForFrame(view, "❯ Install / repair");
  view.stdin.write("\r");
  await vi.waitFor(() => expect(installMacVisualizer).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Pack installed."));
  await waitForFrame(view, "❯ Back");
  view.stdin.write("\u001b");
  await waitForFrame(view, "Player appearance");
});
