import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import stringWidth from "string-width";
import { LyricsPanel } from "../src/ui/components/LyricsPanel";
import { StoreContext } from "../src/ui/store";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { trackFromUrl } from "../src/player/url";
import { loadLyrics, type LyricsResult } from "../src/player/lyrics";
vi.mock("../src/player/lyrics", async original => ({ ...await original<typeof import("../src/player/lyrics")>(), loadLyrics: vi.fn() }));
const fixture: LyricsResult = { message: "", lyrics: { source: "LRCLIB", lines: [{ at: 0, text: "Fixture line" }], plain: ["Fixture line"] } };
const wait = (ms = 450) => new Promise(r => setTimeout(r, ms));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("lyrics panel boundaries", () => {
  it("centres a small neighbourhood around the active line instead of showing the whole song", async () => {
    const lines = Array.from({ length: 20 }, (_, i) => ({ at: i, text: `Fixture number ${i}` }));
    vi.mocked(loadLyrics).mockResolvedValue({ message: "", lyrics: { source: "LRCLIB", lines, plain: lines.map(l => l.text) } });
    const store = makeStore({ playback: makeFakePlayback({ position: 7 }) });
    const view = render(<StoreContext.Provider value={store}><LyricsPanel width={70} height={30} active /></StoreContext.Provider>);
    await wait();
    const frame = view.lastFrame()!;
    expect(frame).toContain("› Fixture number 7"); expect(frame).not.toContain("Fixture number 0"); expect(frame).not.toContain("Fixture number 19");
    const activeRow = frame.split("\n").findIndex(row => row.includes("› Fixture"));
    expect(activeRow).toBeGreaterThan(10); expect(activeRow).toBeLessThan(19);
    view.stdin.write("\u001b[A"); await wait(30); expect(view.lastFrame()).toContain("browsing");
    view.stdin.write("f"); await wait(30); expect(view.lastFrame()).toContain("following playback");
    expect(loadLyrics).toHaveBeenCalledTimes(1);
  });
  it("wraps long active lines within a narrow panel and shows genuine word-sync status", async () => {
    const words = [{ at: 0, text: "First" }, { at: 1, text: "second" }, { at: 2, text: "東京🎵" }, { at: 3, text: "longlonglongword" }];
    const text = words.map(w => w.text).join(" ");
    vi.mocked(loadLyrics).mockResolvedValue({ message: "", lyrics: { source: "Local LRC", lines: [{ at: 0, text, words }], plain: [text] } });
    const store = makeStore({ playback: makeFakePlayback({ position: 2 }) });
    const view = render(<StoreContext.Provider value={store}><LyricsPanel width={35} height={14} active /></StoreContext.Provider>);
    await wait(); const rows = view.lastFrame()!.split("\n");
    expect(view.lastFrame()).toContain("Word-synced"); expect(view.lastFrame()).toContain("longlonglongword");
    expect(rows.length).toBeLessThanOrEqual(14); expect(Math.max(...rows.map(stringWidth))).toBeLessThanOrEqual(35);
  });
  it("never invents radio sync even when timed lyrics are available", async () => {
    vi.mocked(loadLyrics).mockResolvedValue(fixture);
    const t = trackFromUrl("https://example.com/live", true);
    const store = makeStore({ playback: makeFakePlayback({ track: t, broadcastTitle: "Artist - Song" }) });
    const view = render(<StoreContext.Provider value={store}><LyricsPanel width={60} height={14} active /></StoreContext.Provider>);
    await wait(); expect(view.lastFrame()).toContain("song position unknown");
    expect(view.lastFrame()).toContain("Fixture line"); expect(view.lastFrame()).not.toContain("› Fixture line");
  });
  it("aborts old/hidden requests and ignores stale responses", async () => {
    let oldResolve!: (v: LyricsResult) => void;
    vi.mocked(loadLyrics).mockImplementationOnce(() => new Promise(resolve => { oldResolve = resolve; })).mockResolvedValue(fixture);
    const first = makeStore();
    const second = makeStore({ playback: makeFakePlayback({ track: { ...first.playback.getState().track!, id: "new", title: "New" } }) });
    const node = (store: typeof first, active = true) => <StoreContext.Provider value={store}><LyricsPanel width={60} height={14} active={active} /></StoreContext.Provider>;
    const view = render(node(first)); await wait();
    const oldSignal = vi.mocked(loadLyrics).mock.calls[0]![1].signal;
    view.rerender(node(second)); await wait(); expect(oldSignal.aborted).toBe(true);
    oldResolve({ message: "STALE RESPONSE" });
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Fixture line"), { timeout: 2000 });
    expect(view.lastFrame()).toContain("Fixture line"); expect(view.lastFrame()).not.toContain("STALE RESPONSE");
    const currentSignal = vi.mocked(loadLyrics).mock.calls[1]![1].signal;
    view.rerender(node(second, false)); await wait();
    expect(currentSignal.aborted).toBe(true); expect(loadLyrics).toHaveBeenCalledTimes(2);
  });
  it("bounds loading, unavailable and instrumental states in small panels", async () => {
    for (const result of [{ message: "Unavailable ".repeat(100) }, { message: "", lyrics: { ...fixture.lyrics!, instrumental: true } }]) {
      vi.mocked(loadLyrics).mockResolvedValue(result);
      for (const [width, height] of [[35, 5], [40, 8], [60, 14]]) {
        const store = makeStore();
        const view = render(<StoreContext.Provider value={store}><LyricsPanel width={width!} height={height!} active /></StoreContext.Provider>);
        for (const timeout of [30, 430]) {
          await wait(timeout);
          const rows = view.lastFrame()!.split("\n");
          expect(rows.length).toBeLessThanOrEqual(height!);
          expect(Math.max(...rows.map(stringWidth))).toBeLessThanOrEqual(width!);
        }
        view.unmount();
      }
    }
  });
});
