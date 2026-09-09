import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { Home } from "../src/ui/sections/Home";
import { ASCII_JUKEBOX, JUKEBOX_MARK } from "../src/ui/components/JukeboxMark";
afterEach(cleanup);
const tick = () => new Promise(r => setTimeout(r, 30));
describe("listening-first Home", () => {
  it("shows a protocol-independent jukebox on roomy first launch; no implicit download", async () => {
    const setConfig = vi.fn(), setSection = vi.fn(), setPendingSearch = vi.fn();
    const store = makeStore({ rows: 40, contentWidth: 90, setConfig, setSection, setPendingSearch });
    const view = render(<StoreContext.Provider value={store}><Home firstRun /></StoreContext.Provider>);
    expect(view.lastFrame()).toContain("Welcome to JukeboxCli");
    expect(view.lastFrame()).toContain("⠿⠿");
    expect(setConfig).not.toHaveBeenCalled();
    await tick(); view.stdin.write("\r"); await tick();
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ firstRunComplete: true }));
    expect(setSection).toHaveBeenCalledWith("discover");
    expect(setPendingSearch).toHaveBeenCalledWith(true);
  });
  it("routes radio and skips onboarding without starting playback", async () => {
    const setSection = vi.fn(), setOpenUrlRequest = vi.fn();
    const store = makeStore({ setSection, setOpenUrlRequest });
    const view = render(<StoreContext.Provider value={store}><Home firstRun /></StoreContext.Provider>);
    await tick(); view.stdin.write("\x1b[B"); await tick(); view.stdin.write("\r"); await tick();
    expect(setSection).toHaveBeenCalledWith("listen"); expect(setOpenUrlRequest).toHaveBeenCalled();
    view.stdin.write("\x1b"); await tick();
    expect(setSection).toHaveBeenCalledWith("home");
  });
  it("keeps the choices in short terminals and leaves sidebar input alone", async () => {
    const setSection = vi.fn();
    const store = makeStore({ rows: 18, cols: 60, contentWidth: 35, region: "sidebar", setSection });
    const view = render(<StoreContext.Provider value={store}><Home /></StoreContext.Provider>);
    expect(view.lastFrame()).not.toContain("⠿"); expect(view.lastFrame()).toContain("Search and play online");
    expect(view.lastFrame()!.split("\n").length).toBeLessThanOrEqual(10);
    await tick(); view.stdin.write("\r"); await tick(); expect(setSection).not.toHaveBeenCalled();
  });
  it("offers an ASCII-only alternative without any escape sequences", () => {
    expect(ASCII_JUKEBOX).toMatch(/^[\x20-\x7e\n]+$/);
    expect(JUKEBOX_MARK).not.toContain("\x1b");
  });
  it("aligns both cabinet walls with the bottom corners in both marks", () => {
    for (const mark of [JUKEBOX_MARK, ASCII_JUKEBOX]) {
      const lines = mark.split("\n");
      const bottom = lines.at(-1)!;
      for (const row of lines.slice(3, -1)) {
        expect(row.indexOf("|")).toBe(bottom.indexOf("'"));
        expect(row.lastIndexOf("|")).toBe(bottom.lastIndexOf("'"));
      }
    }
  });
});
