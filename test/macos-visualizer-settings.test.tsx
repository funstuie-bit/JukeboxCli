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
const wait = () => new Promise(resolve => setTimeout(resolve, 40));

it("requires confirmation and keeps hooks stable across the Mac installer page", async () => {
  vi.spyOn(process, "platform", "get").mockReturnValue("darwin");
  vi.mocked(installMacVisualizer).mockImplementation(async progress => { progress?.("Pack installed."); });
  const view = render(<StoreContext.Provider value={makeStore({ region: "content", listRows: 30 })}><Settings /></StoreContext.Provider>);
  await wait();
  view.stdin.write("\u001b[F"); await wait();
  view.stdin.write("\r"); await wait();
  expect(view.lastFrame()).toContain("Install Mac fullscreen pack");
  for (let i = 0; i < 4; i++) { view.stdin.write("\u001b[B"); await wait(); }
  view.stdin.write("\r"); await wait();
  expect(view.lastFrame()).toContain("Download and install this optional pack?");
  expect(installMacVisualizer).not.toHaveBeenCalled();
  view.stdin.write("\u001b[B"); await wait();
  view.stdin.write("\r");
  await vi.waitFor(() => expect(installMacVisualizer).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Pack installed."));
  view.stdin.write("\u001b"); await wait();
  expect(view.lastFrame()).toContain("Player appearance");
});
