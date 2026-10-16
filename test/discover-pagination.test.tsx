import { rmSync } from "node:fs";
import { SearchHistory, searchHistoryFile } from "../src/sources/search-history";
import stringWidth from "string-width";
import { beforeEach, expect, it, vi } from "vitest";
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
vi.mock("../src/player/art", () => ({ loadCoverArt: async () => null }));
beforeEach(() => { rmSync(searchHistoryFile, { force: true }); });
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


it("video section searches on entry, plays video directly, offers audio and retains results/selection after leaving", async () => {
  const track = trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk");
  const more = vi.fn(async () => ({ title: "Video results", items: [{ id: "second", title: "Second video", kind: "video", track }] }));
  fixture.videos.mockResolvedValue({ title: "Video results", items: [{ id: "first", title: "YouTube video fixture", kind: "video", track }], more });
  const store = makeStore({ region: "content", contentWidth: 100 });
  store.playback.selectTrack = vi.fn(async () => {}); store.playback.enqueue = vi.fn();
  const node = () => <StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>;
  const view = await renderReady(node());
  expect(view.lastFrame()).toContain("Search YouTube videos");
  await press(view, "cyberpunk radio"); await press(view, "\r");
  expect(fixture.videos).toHaveBeenCalledWith("cyberpunk radio", expect.any(AbortSignal));
  expect(view.lastFrame()).toContain("YouTube video fixture");
  expect(store.playback.selectTrack).not.toHaveBeenCalled();
  await press(view, "\r"); expect(store.playback.selectTrack).toHaveBeenLastCalledWith(track, [track], "video");
  await press(view, "a"); expect(store.playback.selectTrack).toHaveBeenLastCalledWith(track, [track], "audio");
  await press(view, "L"); await press(view, "\x1b[B"); expect(view.lastFrame()).toContain("2/2");
  await act(async () => { view.unmount(); });
  const music = await renderReady(<StoreContext.Provider value={store}><Discover /></StoreContext.Provider>);
  expect(music.lastFrame()).not.toContain("YouTube video fixture"); await act(async () => { music.unmount(); });
  const returned = await renderReady(node());
  expect(returned.lastFrame()).toContain("Search: cyberpunk radio");
  expect(returned.lastFrame()).toContain("Second video"); expect(returned.lastFrame()).toContain("2/2");
  returned.unmount();
});
it("cancels a hidden video search and ignores its late result", async () => {
  let resolve!: (value: any) => void;
  fixture.videos.mockImplementation(() => new Promise(r => { resolve = r; }));
  const store = makeStore({ region: "content", contentWidth: 100 });
  const node = () => <StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>;
  const view = await renderReady(node());
  await press(view, "slow"); await press(view, "\r");
  const signal = fixture.videos.mock.calls.at(-1)![1];
  await act(async () => { view.unmount(); }); expect(signal.aborted).toBe(true);
  await act(async () => { resolve({ title: "Stale", items: [{ id: "late", title: "Stale video", kind: "video" }] }); });
  const returned = await renderReady(node());
  expect(returned.lastFrame()).not.toContain("Stale video");
  expect(new SearchHistory().recent(true)).toEqual([]); returned.unmount();
});

it("fits compact video results and offers plain icon fallbacks", async () => {
  vi.stubEnv("JUKEBOXCLI_ICONS", "ascii");
  try {
    const track = { ...trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk"), title: "Video title", artist: "Channel", isLive: true };
    fixture.videos.mockResolvedValue({ title: "Results", items: [{id:"live",title:"Video title",kind:"video",track}] });
    const store = makeStore({ region:"content",contentWidth:40,listRows:12 });
    const view = await renderReady(<StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>);
    await press(view,"live"); await press(view,"\r");
    const frame=view.lastFrame()!;
    expect(frame).toContain("LIVE"); expect(frame).not.toContain("▶"); expect(frame).toContain("*  Video title");
    expect(Math.max(...frame.split("\n").map(stringWidth))).toBeLessThanOrEqual(40);
    expect(frame.split("\n").length).toBeLessThanOrEqual(12); view.unmount();
  } finally { vi.unstubAllEnvs(); }
});

it("explains live download refusal for keyboard and menu without leaving results", async () => {
  const track = { ...trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk"), isLive: true };
  fixture.videos.mockResolvedValue({ title: "Live results", items: [{ id: "live", title: "Live station", kind: "video", track }] });
  const store = makeStore({ region: "content", contentWidth: 120 });
  store.setPendingAdd = vi.fn(); store.setSection = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>);
  await press(view, "live"); await press(view, "\r"); await press(view, "d");
  expect(view.lastFrame()).toContain("Live streams cannot be downloaded");
  await press(view, "c"); expect(view.lastFrame()).toContain("Download: live stream (play only)");
  for (let i = 0; i < 4; i++) await press(view, "\x1b[B");
  await press(view, "\r");
  expect(view.lastFrame()).toContain("Live streams cannot be downloaded");
  expect(store.setPendingAdd).not.toHaveBeenCalled(); expect(store.setSection).not.toHaveBeenCalled();
});

it("restores saved video results with a new playback session, reopens recent searches and clears them", async () => {
  const track = { ...trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk"), artist: "Test channel", durationSec: 123 };
  fixture.videos.mockImplementation(async (query: string) => ({ title: query, items: [
    { id: "one", kind: "video", title: `${query} first`, track },
    { id: "two", kind: "video", title: `${query} second`, track },
  ] }));
  let store = makeStore({ region: "content", contentWidth: 100, listRows: 20 });
  let view = await renderReady(<StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>);
  await press(view, "ambient"); await press(view, "\r"); await press(view, "\x1b[B");
  await act(async () => view.unmount());
  fixture.videos.mockClear();
  store = makeStore({ region: "content", contentWidth: 100, listRows: 20 });
  store.playback.selectTrack = vi.fn(async () => {});
  view = await renderReady(<StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>);
  expect(view.lastFrame()).toContain("Search: ambient"); expect(view.lastFrame()).toContain("2/2");
  expect(view.lastFrame()).toContain("saved results"); expect(fixture.videos).not.toHaveBeenCalled();
  await press(view, "h"); expect(view.lastFrame()).toContain("Recent searches");
  await press(view, "\r"); expect(fixture.videos).toHaveBeenCalledWith("ambient", expect.any(AbortSignal));
  expect(store.playback.selectTrack).not.toHaveBeenCalled();
  await press(view, "h"); await press(view, "\x1b[B"); await press(view, "\r");
  expect(view.lastFrame()).toContain("Saved search history cleared");
  expect(new SearchHistory().recent(true)).toEqual([]);
  await act(async () => view.unmount());
  expect(new SearchHistory().last(true)).toBeUndefined();
});

it("keeps a responsive preview beside results, follows selection and suspends it under menus", async () => {
  const track = trackFromUrl("https://www.youtube.com/watch?v=abcdefghijk");
  fixture.videos.mockResolvedValue({ title: "Preview search", items: [
    { id: "one", kind: "video", title: "First preview", track: { ...track, artist: "First channel", durationSec: 120 } },
    { id: "two", kind: "video", title: "Second preview", track: { ...track, artist: "Second channel", isLive: true } },
  ] });
  const store = makeStore({ region: "content", contentWidth: 120, listRows: 20 });
  store.playback.selectTrack = vi.fn(async () => {});
  const node = () => <StoreContext.Provider value={store}><Discover videos /></StoreContext.Provider>;
  const view = await renderReady(node());
  await press(view, "preview"); await press(view, "\r");
  expect(view.lastFrame()).toContain("Video preview"); expect(view.lastFrame()).toContain("2:00");
  expect(view.lastFrame()!.match(/First preview/g)?.length, view.lastFrame()).toBe(2);
  await press(view, "\x1b[B"); expect(view.lastFrame()).toContain("LIVE · play only");
  expect(store.playback.selectTrack).not.toHaveBeenCalled();
  await press(view, "c"); expect(view.lastFrame()).toContain("Play video");
  await press(view, "\x1b"); await vi.waitFor(() => expect(view.lastFrame()).not.toContain("Play video"));
  await press(view, "i"); expect(view.lastFrame()).not.toContain("Video preview");
  await press(view, "i"); expect(view.lastFrame()).toContain("Video preview");
  store.contentWidth = 40; store.listRows = 12;
  await act(async () => view.rerender(node()));
  expect(view.lastFrame()).not.toContain("Video preview");
  expect(Math.max(...view.lastFrame()!.split("\n").map(stringWidth))).toBeLessThanOrEqual(40);
  expect(view.lastFrame()!.split("\n").length).toBeLessThanOrEqual(12);
});
