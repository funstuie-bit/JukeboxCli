import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cleanup, render } from "ink-testing-library";
import { PlayHistory } from "../src/player/history";
import { trackFromUrl } from "../src/player/url";
import { StoreContext } from "../src/ui/store";
import { History } from "../src/ui/sections/History";
import { Home } from "../src/ui/sections/Home";
import { makeStore, makeFakeLibrary, makeFakePlayback } from "../scripts/fake-data";
afterEach(cleanup);
const stream = { ...trackFromUrl("https://example.com/song.mp3"), title: "Stream fixture", durationSec: 259 };
const tick = () => new Promise(r => setTimeout(r, 50));

it("keeps legacy history, persists allowlisted streams privately and retains them when local files disappear", async () => {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "jukeboxcli-history-")), "history.json");
  await writeFile(file, JSON.stringify({ version: 1, entries: [{ id: "old-local", at: "2026-09-09" }] }));
  const history = await PlayHistory.load(file);
  history.record({ ...stream, headers: { Authorization: "secret" }, url: "https://signed.example/secret" } as typeof stream);
  await history.flush();
  expect(history.ids()).toEqual([stream.id, "old-local"]);
  const saved = await readFile(file, "utf8");
  expect(saved).not.toContain("secret");
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  const restored = await PlayHistory.load(file);
  expect(restored.getStream(stream.id)?.durationSec).toBe(259);
  restored.retain(() => false);
  expect(restored.ids()).toEqual([stream.id]);
  restored.record(stream); expect(restored.ids()).toEqual([stream.id]);
  restored.remove(stream.id); await restored.flush();
  expect((await PlayHistory.load(file)).ids()).toEqual([]);
});

it("rejects unsafe persisted stream URLs", async () => {
  const file = path.join(await mkdtemp(path.join(tmpdir(), "jukeboxcli-history-")), "history.json");
  await writeFile(file, JSON.stringify({ version: 1, entries: [{ id: stream.id, at: "today", stream: { ...stream, streamUrl: "file:///secret" } }] }));
  expect((await PlayHistory.load(file)).getStream(stream.id)).toBeUndefined();
});

it("shows and replays a stream from History and Home without adding a library file", async () => {
  const history = PlayHistory.empty(); history.record(stream);
  const playTrack = vi.fn();
  const store = makeStore({ history, playTrack, playback: makeFakePlayback({ track: stream }), library: makeFakeLibrary([]), region: "content", rows: 40, contentWidth: 90 });
  const view = render(<StoreContext.Provider value={store}><History /></StoreContext.Provider>);
  expect(view.lastFrame()).toContain("Stream fixture");
  expect(view.lastFrame()).toContain("4:19");
  await tick(); view.stdin.write("\r"); await tick();
  expect(playTrack).toHaveBeenCalledWith(expect.objectContaining({ id: stream.id }), expect.any(Array));
  view.unmount(); playTrack.mockClear();
  const home = render(<StoreContext.Provider value={store}><Home /></StoreContext.Provider>);
  expect(home.lastFrame()).toContain("Recent · Stream fixture");
  await tick();
  for (let i = 0; i < 4; i++) { home.stdin.write("\x1b[B"); await tick(); }
  home.stdin.write("\r"); await tick();
  expect(playTrack).toHaveBeenCalledWith(expect.objectContaining({ id: stream.id }));
  expect(store.library.has(stream.id)).toBe(false);
  home.unmount();
  const remove = render(<StoreContext.Provider value={store}><History /></StoreContext.Provider>);
  await tick(); remove.stdin.write("d"); await tick();
  expect(remove.lastFrame()).toContain("Remove from history");
  remove.stdin.write("y"); await tick();
  expect(history.ids()).toEqual([]);
});
