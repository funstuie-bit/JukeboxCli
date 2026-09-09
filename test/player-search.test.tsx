import { afterEach, describe, expect, it, vi } from "vitest";
import { render, cleanup } from "ink-testing-library";
import stringWidth from "string-width";
import { PlayerSearch, playerQuery } from "../src/ui/components/PlayerSearch";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { searchMusic, type MusicPage } from "../src/sources/music";
vi.mock("../src/sources/music", () => ({ searchMusic: vi.fn() }));
const tick = () => new Promise(r => setTimeout(r, 30));
const page = (count = 1): MusicPage => ({ title: "fixture", items: Array.from({ length: count }, (_, i) => ({
  id: String(i), kind: "song", title: `Result ${i}`, track: { kind: "stream", id: String(i), source: "youtube", sourceTrackId: String(i),
    title: `Result ${i}`, streamUrl: `https://example.com/${i}`, addedAt: "2026-09-08" },
})) });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe("player search", () => {
  it("parses explicit sources and defaults to local without a network request", () => {
    expect(playerQuery("/s: artist song")).toEqual({ mode: "s", query: "artist song" });
    expect(playerQuery("v: live")).toEqual({ mode: "v", query: "live" });
    expect(playerQuery("Artist")).toEqual({ mode: "l", query: "Artist" });
    expect(playerQuery("l: " + "x".repeat(500)).query).toHaveLength(200);
  });
  it("searches local files offline, queues next and refuses a redundant download", async () => {
    const store = makeStore(); store.playback.enqueue = vi.fn(); store.playback.selectTrack = vi.fn().mockResolvedValue(undefined);
    store.setPendingAdd = vi.fn();
    const view = render(<StoreContext.Provider value={store}><PlayerSearch width={65} height={14} active onClose={() => {}} onDownload={() => {}} /></StoreContext.Provider>);
    await tick(); view.stdin.write("l: Song"); await tick(); view.stdin.write("\r"); await tick();
    expect(view.lastFrame()).toContain("Song Title"); expect(searchMusic).not.toHaveBeenCalled();
    view.stdin.write("P"); await tick(); expect(store.playback.enqueue).toHaveBeenCalledWith(expect.objectContaining({ title: "Song Title" }), true);
    view.stdin.write("d"); await tick(); expect(store.setPendingAdd).not.toHaveBeenCalled();
    expect(view.lastFrame()).toContain("Already saved locally");
    view.stdin.write("\r"); await tick(); expect(store.playback.selectTrack).toHaveBeenCalledTimes(1);
  });
  it("aborts hidden searches and ignores responses even if a provider ignores cancellation", async () => {
    let resolve!: (p: MusicPage) => void;
    vi.mocked(searchMusic).mockImplementation(() => new Promise(r => { resolve = r; }));
    const store = makeStore(), close = vi.fn();
    const node = (active: boolean) => <StoreContext.Provider value={store}><PlayerSearch width={60} height={14} active={active} onClose={close} onDownload={() => {}} /></StoreContext.Provider>;
    const view = render(node(true)); await tick(); view.stdin.write("s: slow"); await tick(); view.stdin.write("\r"); await tick();
    const signal = vi.mocked(searchMusic).mock.calls[0]![2]!;
    view.rerender(node(false)); await tick(); expect(signal.aborted).toBe(true);
    resolve(page()); await tick(); expect(view.lastFrame()).not.toContain("Result 0");
  });
  it("bounds and deduplicates pagination, handles failures and fits narrow terminals", async () => {
    const more = vi.fn().mockResolvedValue(page(300));
    vi.mocked(searchMusic).mockResolvedValue({ ...page(10), more });
    const store = makeStore();
    const view = render(<StoreContext.Provider value={store}><PlayerSearch width={35} height={8} active onClose={() => {}} onDownload={() => {}} /></StoreContext.Provider>);
    await tick(); view.stdin.write("s: fixture"); await tick(); view.stdin.write("\r"); await tick();
    view.stdin.write("L"); await tick(); expect(view.lastFrame()).toContain("200/200");
    view.stdin.write("L"); await tick(); expect(more).toHaveBeenCalledTimes(1);
    const rows = view.lastFrame()!.split("\n"); expect(rows.length).toBeLessThanOrEqual(8);
    expect(Math.max(...rows.map(stringWidth))).toBeLessThanOrEqual(35);
    vi.mocked(searchMusic).mockRejectedValue(Error("offline"));
    view.stdin.write("/"); await tick(); view.stdin.write("\r"); await tick(); expect(view.lastFrame()).toContain("Search failed");
  });
});
