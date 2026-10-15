import { expect, it, vi } from "vitest";
import { press, renderReady, act } from "./ink-input";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { mouseEvents, mousePresses } from "../src/ui/mouse";
import { Discover } from "../src/ui/sections/Discover";
import { trackFromUrl } from "../src/player/url";
const fixture = vi.hoisted(() => ({ more: vi.fn(), browse: vi.fn(), videos: vi.fn() }));
vi.mock("../src/sources/music", async importOriginal => ({
  ...await importOriginal<typeof import("../src/sources/music")>(),
  searchMusic: async () => ({ title: "Results", items: [{ id: "1", title: "First album", kind: "album" }], more: fixture.more }),
  browseMusic: fixture.browse,
  searchYouTubeVideos: fixture.videos,
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

it("opens actions by right click or keyboard without losing results, and plays video explicitly", async () => {
  const song = trackFromUrl("https://example.com/video.mp4", false);
  fixture.browse.mockResolvedValue({ title: "Inside album", items: [{ id: "song", kind: "video", title: "Video song", track: song }] });
  const store = makeStore({ region: "content" }); store.config.mouseMode = "click";
  store.playback.selectTrack = vi.fn(async () => {});
  const view = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
  await press(view, "/"); await press(view, "album"); await press(view, "\r"); await press(view, "\r");
  await vi.waitFor(() => expect(view.lastFrame()).toContain("Video song"));
  const y = view.lastFrame()!.split("\n").findIndex(row => row.includes("Video song"));
  await act(async () => { mouseEvents.emit("press", mousePresses(`\x1b[<2;3;${y + 1}M`)[0]); });
  expect(view.lastFrame()).toContain("Play video");
  expect(store.playback.selectTrack).not.toHaveBeenCalled();
  await press(view, "\x1b[B"); await press(view, "\r");
  expect(store.playback.selectTrack).toHaveBeenCalledWith(song, [song], "video");
  expect(view.lastFrame()).toContain("Video song");
  await press(view, "c"); expect(view.lastFrame()).toContain("Play audio");
  await press(view, "\x1b"); await vi.waitFor(() => expect(view.lastFrame()).not.toContain("Play video"));
  view.unmount();
});

it("switches catalogue, paginates video results and offers audio/video actions without starting playback on search", async () => {
  const track = trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk");
  const more = vi.fn(async () => ({ title: "Video results", items: [{ id: "second", title: "Second video", kind: "video", track }] }));
  fixture.videos.mockResolvedValue({ title: "Video results", items: [{ id: "first", title: "YouTube video fixture", kind: "video", track }], more });
  const store = makeStore({ region: "content", contentWidth: 100 });
  store.playback.selectTrack = vi.fn(async () => {}); store.playback.enqueue = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
  await press(view, "Y"); expect(view.lastFrame()).toContain("Search YouTube videos");
  await press(view, "cyberpunk radio"); await press(view, "\r");
  expect(fixture.videos).toHaveBeenCalledWith("cyberpunk radio", expect.any(AbortSignal));
  expect(view.lastFrame()).toContain("[YouTube Videos]");
  expect(view.lastFrame()).toContain("YouTube video fixture");
  expect(store.playback.selectTrack).not.toHaveBeenCalled();
  await press(view, "L"); expect(view.lastFrame()).toContain("Second video");
  await press(view, "c"); await press(view, "\x1b[B"); await press(view, "\r");
  expect(store.playback.selectTrack).toHaveBeenCalledWith(track, [track], "video");
  await press(view, "Y"); expect(view.lastFrame()).toContain("[YouTube Music]");
  expect(view.lastFrame()).toContain("First album"); view.unmount();
});
it("cancels a video search when switching source and ignores its late result", async () => {
  let resolve!: (value: any) => void;
  fixture.videos.mockImplementation(() => new Promise(r => { resolve = r; }));
  const store = makeStore({ region: "content", contentWidth: 100 });
  const view = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
  await press(view, "Y"); await press(view, "slow"); await press(view, "\r");
  const signal = fixture.videos.mock.calls.at(-1)![1];
  await press(view, "Y"); expect(signal.aborted).toBe(true);
  await act(async () => { resolve({ title: "Stale", items: [{ id: "late", title: "Stale video", kind: "video" }] }); });
  expect(view.lastFrame()).toContain("First album"); expect(view.lastFrame()).not.toContain("Stale video"); view.unmount();
});
