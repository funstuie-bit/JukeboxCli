import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "ink-testing-library";
import { StoreContext } from "../src/ui/store";
import { NowPlaying, playerLayout } from "../src/ui/views/NowPlaying";
import { fitRow, queueRow, ListeningQueue } from "../src/ui/views/ListeningQueue";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { trackFromUrl } from "../src/player/url";
import { playerPalette } from "../src/ui/theme";
import { RadioFallback } from "../src/ui/components/RadioFallback";
import { trackDisplayTitle } from "../src/util/format";
import stringWidth from "string-width";
import { loadWaveform } from "../src/player/art";
vi.mock("../src/player/art", () => ({ loadCoverArt: async () => null, loadWaveform: vi.fn(async () => null) }));
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
describe("responsive listening layout", () => {
  it("uses the player's measured duration only for the current queue occurrence", () => {
    const base = makeStore().playback.getState().track!;
    const track = { ...base, durationSec: 509 };
    const store = makeStore({ playback: makeFakePlayback({ track, list: [track, track], index: 0, duration: 545 }) });
    const view = render(<StoreContext.Provider value={store}><ListeningQueue width={90} height={14} active /></StoreContext.Provider>);
    const rows = view.lastFrame()!.split("\n");
    expect(rows.find(row => row.includes("›▶"))).toContain("9:05");
    expect(rows.filter(row => row.includes("FILE"))[1]).toContain("8:29");
    expect(track.durationSec).toBe(509);
  });
  it("keeps both bottom borders visible with a loaded waveform at short split heights", async () => {
    vi.stubEnv("JUKEBOXCLI_VISUALIZER", "0");
    vi.mocked(loadWaveform).mockResolvedValue({ samples: Array(50).fill(0.5) } as Awaited<ReturnType<typeof loadWaveform>>);
    try {
      for (const height of [16, 18, 22, 23, 24, 25, 26, 28, 38]) {
        const store = makeStore({ cols: 140, listRows: height - 2 });
        const view = render(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
        await vi.waitFor(() => expect(view.lastFrame()).toContain("TRACK WAVEFORM"));
        const rows = view.lastFrame()!.split("\n");
        expect(rows.length).toBeLessThanOrEqual(height);
        const layout = playerLayout(138, height);
        expect(rows.some(row => row[0] === "╰" && row[layout.left - 1] === "╯")).toBe(true);
        expect(rows.some(row => row[layout.left + 1] === "╰" && row[137] === "╯")).toBe(true);
        expect(view.lastFrame()).toContain("Saved locally");
        view.unmount();
      }
    } finally { vi.mocked(loadWaveform).mockResolvedValue(null); }
  });
  it("keeps playing and selected markers distinct when browsing the queue", async () => {
    const store = makeStore();
    const view = render(<StoreContext.Provider value={store}><ListeningQueue width={90} height={14} active /></StoreContext.Provider>);
    expect(view.lastFrame()).toContain("›▶");
    view.stdin.write("\u001b[B"); await new Promise(r => setTimeout(r, 30));
    expect(view.lastFrame()).not.toContain("›▶");
    expect(view.lastFrame()).toContain(" ▶FILE Artist Name");
    expect(view.lastFrame()).toContain("› FILE Artist Name");
    expect(store.playback.getState().index).toBe(0);
  });
  it("caps artwork and fits radio with long broadcast text at every size", async () => {
    expect(playerLayout(180, 50).artRows).toBe(18);
    const t = { ...trackFromUrl("https://example.com/live", true), title: "Fixture Radio" };
    for (const [cols, height] of [[180, 44], [140, 38], [100, 18], [90, 16], [80, 16], [60, 12]]) {
      const store = makeStore({ cols, listRows: height! - 2, playback: makeFakePlayback({ track: t, list: [t, t], broadcastTitle: "Long artist — Song title ".repeat(20) }) });
      const view = render(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
      await new Promise(r => setTimeout(r, 20));
      const frame = view.lastFrame()!;
      expect(frame).not.toContain("No cover art");
      expect(frame).not.toContain("TRACK WAVEFORM");
      expect(frame).toContain("LIVE · no seeking");
      expect(frame.split("\n").length).toBeLessThanOrEqual(height!);
      expect(Math.max(...frame.split("\n").map(s => stringWidth(s)))).toBeLessThanOrEqual(cols!);
      if (cols! >= 100) expect(frame).toContain("RADIO");
      view.unmount();
    }
  });
  it("only runs a decorative timer when motion is enabled and stops it on hide", async () => {
    const interval = vi.spyOn(globalThis, "setInterval");
    const clear = vi.spyOn(globalThis, "clearInterval");
    const node = (animate: boolean) => <RadioFallback live animate={animate} rows={10} palette={playerPalette("calm")} />;
    const view = render(node(false)); await new Promise(r => setTimeout(r, 20));
    expect(interval.mock.calls.filter(c => c[1] === 700)).toHaveLength(0);
    view.rerender(node(true)); await new Promise(r => setTimeout(r, 20));
    const timerIndex = interval.mock.calls.findIndex(c => c[1] === 700);
    expect(timerIndex).toBeGreaterThanOrEqual(0);
    expect(view.lastFrame()).toContain("Decorative animation");
    view.rerender(node(false)); await new Promise(r => setTimeout(r, 20));
    expect(clear).toHaveBeenCalledWith(interval.mock.results[timerIndex]!.value);
    view.unmount(); interval.mockRestore(); clear.mockRestore();
  });
  it("top-aligns the compact player with the queue and stacks on small screens", () => {
    expect(playerLayout(138, 38)).toMatchObject({ split: true });
    expect(playerLayout(58, 12)).toMatchObject({ split: false, showcase: false });
    expect(playerLayout(60, 26, false, true)).toMatchObject({ split: false, showcase: true });
    for (const [cols, height] of [[140, 38], [100, 18], [80, 16], [60, 12]]) {
      const store = makeStore({ cols, listRows: height! - 2 });
      const view = render(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
      const frame = view.lastFrame()!;
      expect(frame).toContain("Playback queue"); expect(frame).toContain("Song Title");
      expect(frame.split("\n").length).toBeLessThanOrEqual(height!);
      expect(Math.max(...frame.split("\n").map(s => stringWidth(s)))).toBeLessThanOrEqual(cols!);
      if (cols! >= 100) {
        expect(frame.split("\n")[1]).toContain("NOW PLAYING");
        expect(frame.split("\n")[1]).toContain("Playback queue");
        expect(frame).toContain("TITLE"); expect(frame).toContain("TYPE");
        expect(frame).not.toContain("[LOCAL]");
      }
      view.unmount();
    }
  });
  it("prioritises artwork and spectrum over a duplicate queue in compact Player", async () => {
    vi.stubEnv("JUKEBOXCLI_VISUALIZER", "1");
    const store = makeStore({ cols: 64, contentWidth: 52, listRows: 24 });
    const view = render(<StoreContext.Provider value={store}><NowPlaying embedded /></StoreContext.Provider>);
    await new Promise(r => setTimeout(r, 20));
    expect(view.lastFrame()).toContain("Cover unavailable");
    expect(view.lastFrame()).toContain("LIVE SPECTRUM");
    expect(view.lastFrame()).not.toContain("Playback queue");
  });
  it("keeps column widths exact for wide characters and long names", () => {
    expect(stringWidth(fitRow("東京 🎵 test", 8))).toBe(8);
    expect(stringWidth(queueRow("東京 🎵".repeat(8), "Long title".repeat(20), "1:23:45", 68))).toBe(68);
    for (const width of [48, 60, 90, 130]) {
      expect(stringWidth(queueRow("東京 🎵".repeat(8), "Long title".repeat(20), "1:23:45", width, "›▶", "LIVE"))).toBe(width);
    }
    expect(playerLayout(180, 50).waveRows).toBe(5);
  });
  it("cycles the live visualizer presentation with lowercase v", async () => {
    vi.stubEnv("JUKEBOXCLI_VISUALIZER", "1");
    const setConfig = vi.fn();
    const store = makeStore({ cols: 120, listRows: 30, setConfig });
    const view = render(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
    view.stdin.write("v");
    await new Promise(r => setTimeout(r, 20));
    expect(setConfig).toHaveBeenCalledWith(expect.objectContaining({ visualizerMode: "smooth" }));
    expect(view.lastFrame()).toContain("CLASSIC PEAK · v");
  });
  it("cleans an appended year for display without editing the stored title", () => {
    const track = { title: "Renegade Soundwave - Leftfield Remix;1994" };
    expect(trackDisplayTitle(track)).toBe("Renegade Soundwave - Leftfield Remix (1994)");
    expect(track.title.endsWith(";1994")).toBe(true);
  });
});
