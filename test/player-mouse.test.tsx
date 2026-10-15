import { expect, it, vi } from "vitest";
import { renderReady, act } from "./ink-input";
import { StoreContext } from "../src/ui/store";
import { makeStore, makeFakePlayback } from "../scripts/fake-data";
import { NowPlaying } from "../src/ui/views/NowPlaying";
import { mouseEvents } from "../src/ui/mouse";
import { trackFromUrl } from "../src/player/url";
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
