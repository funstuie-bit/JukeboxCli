import { expect, it, vi } from "vitest";
import { renderReady, act, press } from "./ink-input";
import { StoreContext } from "../src/ui/store";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { NowPlaying } from "../src/ui/views/NowPlaying";
import { mouseEvents } from "../src/ui/mouse";
import { trackFromUrl } from "../src/player/url";
import { NowPlayingBar } from "../src/ui/components/NowPlayingBar";
vi.mock("../src/player/art", () => ({ loadCoverArt: async () => null, loadWaveform: async () => null }));

it("clicks transport, volume and timeline; text capture blocks clicks and unmount removes listeners", async () => {
  const store = makeStore({ cols: 140, contentWidth: 138, listRows: 32, region: "content" });
  store.config.mouseMode = "click";
  const playback = store.playback;
  playback.prev = vi.fn(); playback.next = vi.fn(); playback.togglePause = vi.fn(); playback.changeVolume = vi.fn(); playback.seek = vi.fn();
  const before = mouseEvents.listenerCount("press");
  const node = () => <StoreContext.Provider value={store}><NowPlaying embedded /></StoreContext.Provider>;
  const app = await renderReady(node());
  const click = async (text: string, offset = 1) => {
    const rows = app.lastFrame()!.split("\n"), y = rows.findIndex(row => row.includes(text));
    expect(y).toBeGreaterThanOrEqual(0);
    await act(async () => { mouseEvents.emit("press", { x: rows[y]!.indexOf(text) + offset, y }); });
  };
  await click("[Prev]"); await click("[Pause]"); await click("[Next]"); await click(" + "); await click(" − ");
  expect(playback.prev).toHaveBeenCalledOnce(); expect(playback.togglePause).toHaveBeenCalledOnce(); expect(playback.next).toHaveBeenCalledOnce();
  expect(playback.changeVolume).toHaveBeenNthCalledWith(1, 5); expect(playback.changeVolume).toHaveBeenNthCalledWith(2, -5);
  await click("─●", 3); expect(playback.seek).toHaveBeenCalledOnce();
  store.captureMode = "text"; await act(async () => { app.rerender(node()); });
  await click("[Next]"); expect(playback.next).toHaveBeenCalledOnce();
  await act(async () => { app.unmount(); }); expect(mouseEvents.listenerCount("press")).toBe(before);
});
it("does not expose a seek target for live radio", async () => {
  const store = makeStore({ cols: 140, contentWidth: 138, listRows: 32, playback: makeFakePlayback({ track: trackFromUrl("https://example.com/radio", true) }) });
  store.config.mouseMode = "click";
  const app = await renderReady(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
  expect(app.lastFrame()).toContain("LIVE · no seeking");
});

it("opens player actions by right click, switches video by click and restores capture on close", async () => {
  const store = makeStore({ cols: 140, contentWidth: 138, listRows: 32, region: "content" });
  store.config.mouseMode = "click";
  store.setCaptureMode = vi.fn();
  store.playback.setPlaybackMode = vi.fn(async () => {});
  store.playback.togglePause = vi.fn(async () => {});
  const app = await renderReady(<StoreContext.Provider value={store}><NowPlaying embedded /></StoreContext.Provider>);
  const target = (label: string) => {
    const rows = app.lastFrame()!.split("\n"), y = rows.findIndex(row => row.includes(label));
    expect(y).toBeGreaterThanOrEqual(0);
    return { x: rows[y]!.indexOf(label) + 1, y };
  };
  await act(async () => { mouseEvents.emit("press", { ...target("[Pause]"), button: "right" }); });
  expect(app.lastFrame()).toContain("Now Playing actions");
  expect(app.lastFrame()).toContain("NOW PLAYING");
  expect(app.lastFrame()).toContain("Playback queue");
  expect(store.setCaptureMode).toHaveBeenLastCalledWith("menu");
  expect(store.playback.togglePause).not.toHaveBeenCalled();
  await act(async () => { mouseEvents.emit("press", target("Open video window")); });
  expect(store.playback.setPlaybackMode).toHaveBeenCalledWith("video");
  expect(store.setCaptureMode).toHaveBeenLastCalledWith("none");
  expect(app.lastFrame()).not.toContain("Now Playing actions");
});

it("dismisses the popup without activating the visible transport underneath", async () => {
  const store = makeStore({ cols: 140, contentWidth: 138, listRows: 32, region: "content" });
  store.config.mouseMode = "click";
  store.playback.next = vi.fn();
  const app = await renderReady(<StoreContext.Provider value={store}><NowPlaying embedded /></StoreContext.Provider>);
  await press(app, "c");
  const lines = app.lastFrame()!.split("\n"), y = lines.findIndex(row => row.includes("[Next]"));
  expect(y).toBeGreaterThanOrEqual(0);
  await act(async () => { mouseEvents.emit("press", { x: lines[y]!.indexOf("[Next]") + 1, y }); });
  expect(app.lastFrame()).not.toContain("Now Playing actions");
  expect(store.playback.next).not.toHaveBeenCalled();
  expect(app.lastFrame()).toContain("Playback queue");
});

it("keeps the queue selection and player layout when navigating and closing popup actions", async () => {
  const store = makeStore({ cols: 140, contentWidth: 138, listRows: 32, region: "content" });
  const app = await renderReady(<StoreContext.Provider value={store}><NowPlaying embedded /></StoreContext.Provider>);
  const before = app.lastFrame();
  await press(app, "c"); await press(app, "\x1b[B"); await press(app, "\x1b[B");
  expect(app.lastFrame()).toContain("Now Playing actions");
  await press(app, "c"); expect(app.lastFrame()).toBe(before);
});

it("exposes explicit cookie recovery by player-menu keyboard and clickable error bar without saving config", async () => {
  const track=trackFromUrl("https://youtu.be/abcdefghijk");
  const store=makeStore({cols:140,contentWidth:138,listRows:32,region:"content",playback:makeFakePlayback({track,cookieRetryAvailable:true,error:"Could not read the selected browser cookies."})});
  store.config.mouseMode="click"; store.setConfig=vi.fn(); store.playback.retryWithoutCookies=vi.fn(async()=>{});
  const app=await renderReady(<StoreContext.Provider value={store}><NowPlaying embedded /></StoreContext.Provider>,140);
  expect(app.lastFrame()).toContain("Cookie access failed"); await press(app,"c");
  expect(app.lastFrame()).toContain("› Retry without cookies"); await press(app,"\r");
  expect(store.playback.retryWithoutCookies).toHaveBeenCalledOnce();
  await act(async()=>app.unmount());
  const bar=await renderReady(<StoreContext.Provider value={store}><NowPlayingBar /></StoreContext.Provider>,140);
  const rows=bar.lastFrame()!.split("\n"),y=rows.findIndex(line=>line.includes("[Retry without cookies]"));
  await act(async()=>{mouseEvents.emit("press",{x:rows[y]!.indexOf("[Retry without cookies]")+1,y});});
  expect(store.playback.retryWithoutCookies).toHaveBeenCalledTimes(2); expect(store.setConfig).not.toHaveBeenCalled();
});
