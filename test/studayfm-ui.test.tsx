import { expect, it, vi } from "vitest";
import { press, renderReady } from "./ink-input";
import { makeStore } from "../scripts/fake-data";
import { StoreContext } from "../src/ui/store";
import { Listen } from "../src/ui/sections/Listen";
import { readStations } from "../src/player/stations";

it("browses without connecting, queues explicitly and saves without duplicates", async () => {
  const store = makeStore({ region: "content", listRows: 20, contentWidth: 100 });
  store.playback.selectTrack = vi.fn().mockResolvedValue(undefined);
  store.playback.enqueue = vi.fn();
  store.playback.refreshStationArtwork = vi.fn();
  store.playback.renameStation = vi.fn();
  const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(Error("No network expected"));
  try {
    const view = await renderReady(<StoreContext.Provider value={store}><Listen /></StoreContext.Provider>);
    expect(readStations()).toEqual([]);
    await press(view, "S");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("[LIVE] C'est Magnifistu"));
    expect(view.lastFrame()).toContain("[LIVE] Tokyo Jazz");
    expect(fetcher).not.toHaveBeenCalled();
    expect(readStations()).toEqual([]);
    expect(store.playback.selectTrack).not.toHaveBeenCalled();
    expect(store.playback.enqueue).not.toHaveBeenCalled();
    await press(view, "A");
    expect(store.playback.enqueue).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: "Studay FM", isLive: true }), false);
    await press(view, "f");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("Name: Studay FM"));
    await press(view, "\r");
    await vi.waitFor(() => expect(readStations()).toHaveLength(1));
    expect(readStations()[0]!.thumbnailUrl).toContain("/images/");
    await press(view, "S");
    await vi.waitFor(() => expect(view.lastFrame()).toContain("[found] [LIVE] StuLoFiDay"));
    expect((view.lastFrame()!.match(/\[LIVE\] Studay FM/g) ?? []).length).toBe(1);
    expect(readStations()).toHaveLength(1);
    expect(store.playback.selectTrack).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  } finally { fetcher.mockRestore(); }
});
