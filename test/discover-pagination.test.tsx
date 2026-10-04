import { expect, it, vi } from "vitest";
import { press, renderReady } from "./ink-input";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { Discover } from "../src/ui/sections/Discover";
import { trackFromUrl } from "../src/player/url";
const fixture = vi.hoisted(() => ({ more: vi.fn(), browse: vi.fn() }));
vi.mock("../src/sources/music", async importOriginal => ({
  ...await importOriginal<typeof import("../src/sources/music")>(),
  searchMusic: async () => ({ title: "Results", items: [{ id: "1", title: "First album", kind: "album" }], more: fixture.more }),
  browseMusic: fixture.browse,
}));
it("only auto-fetches with opt-in and stops at an empty continuation", async () => {
  fixture.more.mockResolvedValue({ title: "Results", items: [], more: fixture.more });
  const store = makeStore({ region: "content" }); store.config.autoLoadMore = true;
  store.playback.selectTrack = vi.fn(); store.playback.enqueue = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
  await press(view, "/"); await press(view, "test"); await press(view, "\r");
  await vi.waitFor(() => expect(fixture.more).toHaveBeenCalledTimes(1));
  await vi.waitFor(() => expect(view.lastFrame()).not.toContain("L load more"));
  await press(view, "\x1b[B");
  expect(fixture.more).toHaveBeenCalledTimes(1);
  expect(store.playback.selectTrack).not.toHaveBeenCalled(); expect(store.playback.enqueue).not.toHaveBeenCalled();
});
it("retains manual L pagination by default", async () => {
  fixture.more.mockClear().mockResolvedValue({ title: "Results", items: [{ id: "2", title: "Second album", kind: "album" }] });
  const store = makeStore({ region: "content" }); store.config.autoLoadMore = false;
  const view = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
  await press(view, "/"); await press(view, "test"); await press(view, "\r");
  await vi.waitFor(() => expect(view.lastFrame()).toContain("First album"));
  expect(fixture.more).not.toHaveBeenCalled();
  await press(view, "L"); await vi.waitFor(() => expect(view.lastFrame()).toContain("Second album"));
  expect(fixture.more).toHaveBeenCalledTimes(1);
});
it("attaches continuation only on explicit play inside an opted-in collection", async () => {
  const song = trackFromUrl("https://example.com/song.mp3", false);
  fixture.browse.mockResolvedValue({ title: "Inside album", items: [{ id: "song", kind: "song", title: "Song", track: song }], more: fixture.more });
  for (const enabled of [false, true]) {
    const store = makeStore({ region: "content" }); store.config.queueContinuation = enabled; store.config.autoLoadMore = false;
    store.playback.selectTrack = vi.fn(async () => {}); store.playback.setContinuation = vi.fn(); store.playback.enqueue = vi.fn();
    const view = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
    await press(view, "/"); await press(view, "album"); await press(view, "\r");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("First album")); await press(view, "\r");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Inside album"));
    expect(store.playback.setContinuation).not.toHaveBeenCalled();
    await press(view, "A"); expect(store.playback.setContinuation).not.toHaveBeenCalled();
    await press(view, "\r"); expect(store.playback.selectTrack).toHaveBeenCalledWith(song, [song]);
    expect(store.playback.setContinuation).toHaveBeenCalledWith(enabled ? expect.any(Function) : undefined);
    view.unmount();
  }
});
