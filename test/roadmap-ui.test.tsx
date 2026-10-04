import { expect, it, vi } from "vitest";
import { renderReady, press, act } from "./ink-input";
import { makeStore } from "../scripts/fake-data";
import { StoreContext } from "../src/ui/store";
import { Playlists } from "../src/ui/sections/Playlists";
import { Diagnostics } from "../src/ui/components/Diagnostics";
import { artworkAccent } from "../src/ui/hooks/useArtworkPalette";
import { mousePresses, mouseEvents } from "../src/ui/mouse";
import { Library } from "../src/library/library";
import { SongList } from "../src/ui/components/SongList";
import { PortablePlaylist } from "../src/ui/components/PortablePlaylist";
import { promises as fs } from "node:fs";
import path from "node:path";
import { paths } from "../src/config/paths";
import { writePlaylist } from "../src/library/portable-playlist";
import { trackFromUrl } from "../src/player/url";

it("opens portable import/export even with an empty library, without playback", async () => {
  const store = makeStore({ region: "content", library: Library.empty() });
  store.playback.enqueueMany = vi.fn(); store.playback.selectTrack = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><Playlists /></StoreContext.Provider>);
  expect(view.lastFrame()).toContain("I Import");
  await press(view, "I"); expect(view.lastFrame()).toContain("Import playlist");
  await press(view, "\x1b"); await vi.waitFor(() => expect(view.lastFrame()).toContain("No playlists yet"));
  await press(view, "E"); expect(view.lastFrame()).toContain("Export playlist");
  await press(view, "\x1b"); await vi.waitFor(() => expect(view.lastFrame()).toContain("No playlists yet"));
  expect(store.playback.enqueueMany).not.toHaveBeenCalled(); expect(store.playback.selectTrack).not.toHaveBeenCalled();
});
it("renders empty diagnostics and refreshes safely", async () => {
  const store = makeStore({ region: "content", listRows: 25 });
  const view = await renderReady(<StoreContext.Provider value={store}><Diagnostics focused /></StoreContext.Provider>);
  await vi.waitFor(() => expect(view.lastFrame()).toContain("No entries yet"));
  await press(view, "R"); await press(view, "\x1b[6~");
  expect(view.lastFrame()).toContain("Export sanitised report");
});
it("lifts saturated artwork accents and falls back for monochrome art", () => {
  expect(artworkAccent({ cols: 1, rows: 1, brightness: 0.2, cells: [{ top: [180, 20, 20], bottom: [180, 20, 20] }] })).toBe("#e1a1a1");
  expect(artworkAccent({ cols: 1, rows: 1, brightness: 0.2, cells: [{ top: [0, 0, 0], bottom: [240, 240, 240] }] })).toBeUndefined();
});
it("decodes only left-button press coordinates, not release or wheel", () => {
  expect(mousePresses("\x1b[<0;5;8M\x1b[<0;5;8m\x1b[<65;5;8M")).toEqual([{ x: 4, y: 7 }]);
});
it("mouse clicks select a visible song row without playing it", async () => {
  const store = makeStore({ region: "content", listRows: 10 }); store.config.mouseMode = "click";
  const select = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><SongList focused
    groups={[{ items: [{ value: "a", title: "Alpha" }, { value: "b", title: "Beta" }] }]} onSelect={select} /></StoreContext.Provider>);
  await act(async () => { mouseEvents.emit("press", { x: 6, y: 1 }); });
  expect(select).not.toHaveBeenCalled();
  await press(view, "\r"); expect(select).toHaveBeenCalledExactlyOnceWith("b");
});
it("previews an imported stream and only queues it after A, once", async () => {
  await fs.mkdir(paths.temp, { recursive: true });
  const file = path.join(paths.temp, "radio.json");
  await writePlaylist(file, [trackFromUrl("https://example.com/radio", true)], "/music");
  const store = makeStore({ region: "content", library: Library.empty() });
  store.playback.enqueueMany = vi.fn(); store.playback.selectTrack = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><PortablePlaylist mode="import" focused onBack={() => {}} /></StoreContext.Provider>);
  await press(view, file); await press(view, "\r");
  await vi.waitFor(() => expect(view.lastFrame()).toContain("1/1 available"));
  expect(store.playback.enqueueMany).not.toHaveBeenCalled();
  await press(view, "A"); await press(view, "A");
  expect(store.playback.enqueueMany).toHaveBeenCalledTimes(1);
  expect(store.playback.selectTrack).not.toHaveBeenCalled();
});
