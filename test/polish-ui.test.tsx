import { expect, it, vi } from "vitest";
import { renderReady, press } from "./ink-input";
import { StoreContext } from "../src/ui/store";
import { makeStore } from "../scripts/fake-data";
import { ThemeEditor } from "../src/ui/components/ThemeEditor";
import { ShortcutEditor } from "../src/ui/components/ShortcutEditor";
import { NowPlaying } from "../src/ui/views/NowPlaying";
import { SongList } from "../src/ui/components/SongList";
import { Text } from "ink";
import { ListeningQueue } from "../src/ui/views/ListeningQueue";
import { BrowsePreview } from "../src/ui/components/BrowsePreview";
import stringWidth from "string-width";
vi.mock("../src/player/art", () => ({ loadCoverArt: async () => null, loadWaveform: async () => null }));

it("previews a theme without writing and discards on Escape", async () => {
  const store = makeStore({ listRows: 24 }); store.setConfig = vi.fn(); const back = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><ThemeEditor focused onBack={back} /></StoreContext.Provider>);
  await press(view, "\r"); expect(view.lastFrame()).toContain("Calm"); expect(store.setConfig).not.toHaveBeenCalled();
  await press(view, "\x1b"); await vi.waitFor(() => expect(back).toHaveBeenCalled());
  expect(store.setConfig).not.toHaveBeenCalled();
});
it("saves a draft explicitly and preserves unrelated configuration", async () => {
  const store = makeStore(); store.setConfig = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><ThemeEditor focused onBack={() => {}} /></StoreContext.Provider>);
  await press(view, "\r"); for (let i = 0; i < 6; i++) await press(view, "\x1b[B"); await press(view, "\r");
  expect(store.setConfig).toHaveBeenCalledWith(expect.objectContaining({ playerTheme: "calm", libraryDir: store.config.libraryDir }));
});
it("reports shortcut conflicts without writing or losing the draft", async () => {
  const store = makeStore(); store.setConfig = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><ShortcutEditor focused onBack={() => {}} /></StoreContext.Provider>);
  await press(view, "\r"); await press(view, "n"); expect(view.lastFrame()).toContain("conflicts");
  expect(store.setConfig).not.toHaveBeenCalled(); await press(view, "!");
  expect(view.lastFrame()).toContain("Play / pause: !"); expect(store.setConfig).not.toHaveBeenCalled();
});
it("holds browsing preview steady while the filter changes", async () => {
  const store = makeStore(); const preview = (id?: string) => <Text>Preview {id}</Text>;
  const node = (items: string[], freezePreview: boolean) => <StoreContext.Provider value={store}><SongList focused={!freezePreview}
    groups={[{ items: items.map(value => ({ value, title: value })) }]} onSelect={() => {}} preview={preview} freezePreview={freezePreview} /></StoreContext.Provider>;
  const view = await renderReady(node(["a", "b"], false)); await press(view, "\x1b[B"); expect(view.lastFrame()).toContain("Preview b");
  view.rerender(node(["a"], true)); await vi.waitFor(() => expect(view.lastFrame()).toContain("Preview b"));
  view.rerender(node(["a"], false)); await vi.waitFor(() => expect(view.lastFrame()).toContain("Preview a"));
});
it("shows an editable Up Next subset and honours rebound remove", async () => {
  const store = makeStore(); store.config.keybindings = { queueRemove: "!" }; store.playback.removeQueue = vi.fn(async () => {});
  const view = await renderReady(<StoreContext.Provider value={store}><ListeningQueue upcoming active height={12} width={80} /></StoreContext.Provider>);
  expect(view.lastFrame()).toContain("Up Next"); await press(view, "x"); expect(store.playback.removeQueue).not.toHaveBeenCalled();
  await press(view, "!"); expect(store.playback.removeQueue).toHaveBeenCalledWith(1);
});
it("keeps Clean layout within wide and small terminals", async () => {
  for (const [cols, height] of [[180, 44], [120, 28], [90, 18], [70, 14]]) {
    const store = makeStore({ cols, listRows: height! - 2 }); store.config.playerLayout = "clean";
    const view = await renderReady(<StoreContext.Provider value={store}><NowPlaying /></StoreContext.Provider>);
    const frame = view.lastFrame()!;
    expect(frame.split("\n").length).toBeLessThanOrEqual(height!);
    expect(Math.max(...frame.split("\n").map(s => stringWidth(s)))).toBeLessThanOrEqual(cols!);
    expect(frame).toContain("Up Next"); view.unmount();
  }
});
it("does not treat Ctrl chords as local marking or deletion commands", async () => {
  const store = makeStore(), remove = vi.fn(), queued = vi.fn();
  const view = await renderReady(<StoreContext.Provider value={store}><SongList focused
    groups={[{ items: [{ value: "a", title: "First" }, { value: "b", title: "Second" }] }]}
    onSelect={() => {}} onDelete={remove} onQueue={(id, next) => queued([id], next)} onQueueMany={queued} /></StoreContext.Provider>);
  await press(view, "\x04"); expect(remove).not.toHaveBeenCalled();
  await press(view, "\x18"); await press(view, "\x1b[B"); await press(view, "A");
  expect(queued).toHaveBeenCalledWith(["b"], false);
});
it("shows the missing artwork fallback rather than claiming previews are hidden", async () => {
  const view = await renderReady(<BrowsePreview rows={12} title="No cover fixture" />);
  expect(view.lastFrame()).toContain("No artwork"); expect(view.lastFrame()).not.toContain("Artwork hidden");
});
it("bounds the queue status and small theme editor without hiding the selected action", async () => {
  const store = makeStore({ listRows: 9 });
  const state = store.playback.getState();
  store.playback.getState = () => ({ ...state, continuationStatus: "Playlist continuation ready" });
  const queue = await renderReady(<StoreContext.Provider value={store}><ListeningQueue active framed height={12} width={80} /></StoreContext.Provider>);
  expect(queue.lastFrame()!.split("\n").length).toBeLessThanOrEqual(12); queue.unmount();
  const view = await renderReady(<StoreContext.Provider value={store}><ThemeEditor focused onBack={() => {}} /></StoreContext.Provider>);
  for (let i = 0; i < 4; i++) await press(view, "\x1b[B"); await press(view, "#");
  expect(view.lastFrame()).toContain("Accent:"); expect(view.lastFrame()!.split("\n").length).toBeLessThanOrEqual(9);
});
