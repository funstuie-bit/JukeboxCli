import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { StoreContext } from "../src/ui/store";
import { NowPlaying, playerLayout } from "../src/ui/views/NowPlaying";
import { fitRow, queueRow } from "../src/ui/views/ListeningQueue";
import { makeStore } from "../scripts/fake-data";
import { trackDisplayTitle } from "../src/util/format";
import stringWidth from "string-width";
vi.mock("../src/player/art", () => ({ loadCoverArt: async () => null, loadWaveform: async () => null }));
afterEach(cleanup);
describe("responsive listening layout", () => {
  it("uses two full-height panels on wide screens and stacks on small ones", () => {
    expect(playerLayout(138, 38)).toMatchObject({ split: true });
    expect(playerLayout(58, 12).split).toBe(false);
    for (const [cols, height] of [[140, 38], [100, 18], [80, 16], [60, 12]]) {
      const store = makeStore({ cols, listRows: height! - 2 });
      const view = render(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
      const frame = view.lastFrame()!;
      expect(frame).toContain("Queue"); expect(frame).toContain("Song Title");
      expect(frame.split("\n").length).toBeLessThanOrEqual(height!);
      expect(Math.max(...frame.split("\n").map(s => stringWidth(s)))).toBeLessThanOrEqual(cols!);
      if (cols! >= 100) { expect(frame).toContain("NOW PLAYING"); expect(frame).toContain("TITLE"); }
      view.unmount();
    }
  });
  it("keeps column widths exact for wide characters and long names", () => {
    expect(stringWidth(fitRow("東京 🎵 test", 8))).toBe(8);
    expect(stringWidth(queueRow("東京 🎵".repeat(8), "Long title".repeat(20), "1:23:45", 68))).toBe(68);
  });
  it("cleans an appended year for display without editing the stored title", () => {
    const track = { title: "Renegade Soundwave - Leftfield Remix;1994" };
    expect(trackDisplayTitle(track)).toBe("Renegade Soundwave - Leftfield Remix (1994)");
    expect(track.title.endsWith(";1994")).toBe(true);
  });
});
