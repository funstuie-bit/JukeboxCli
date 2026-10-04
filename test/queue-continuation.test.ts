import { expect, it, vi } from "vitest";
import { Playback } from "../src/player/playback";
import { QueueContinuation, type QueuePage } from "../src/player/continuation";
import type { Track } from "../src/library/types";
const track = (id: string): Track => ({ id, title: id, source: "youtube", sourceTrackId: id, filePath: `/music/${id}.mp3`, addedAt: "2026-10-04" });

it("requires opt-in and does not change playback while appending", async () => {
  const opened = vi.fn(), p = new Playback(null, opened);
  await p.play(track("a"));
  const more = vi.fn(async () => ({ tracks: [track("b")] }));
  p.setContinuation(more); expect(more).not.toHaveBeenCalled();
  p.setContinuationEnabled(true); p.setContinuation(more);
  await vi.waitFor(() => expect(p.getState().list).toHaveLength(2));
  expect(p.getState().track?.id).toBe("a"); expect(opened).toHaveBeenCalledTimes(1);
  await p.next(); expect(p.getState().track?.id).toBe("b"); p.quit();
});
it("preserves manual next/reorder/removal during an in-flight page", async () => {
  let resolve!: (page: QueuePage) => void;
  const p = new Playback(null, () => {}); await p.play(track("a"), [track("a"), track("b")]);
  p.setContinuationEnabled(true); p.setContinuation(() => new Promise(r => { resolve = r; }));
  p.enqueue(track("manual"), true); await p.removeQueue(2);
  resolve({ tracks: [track("b"), track("c")] });
  await vi.waitFor(() => expect(p.getState().list.map(t => t.id)).toEqual(["a", "manual", "c"]));
  expect(p.getState().track?.id).toBe("a"); p.quit();
});
it("ignores stale results after stop, different context or disabling", async () => {
  for (const action of ["stop", "replace", "disable"] as const) {
    let resolve!: (page: QueuePage) => void;
    const p = new Playback(null, () => {}); await p.play(track("a"));
    p.setContinuationEnabled(true); p.setContinuation(() => new Promise(r => { resolve = r; }));
    if (action === "stop") await p.stop();
    if (action === "replace") await p.play(track("other"));
    if (action === "disable") p.setContinuationEnabled(false);
    resolve({ tracks: [track("stale")] }); await new Promise(r => setTimeout(r, 5));
    expect(p.getState().list.some(t => t.id === "stale")).toBe(false); p.quit();
  }
});
it("deduplicates requests and repeated pages, and retries failures only explicitly", async () => {
  const append = vi.fn(), status = vi.fn();
  const more = vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue({ tracks: [track("b")], more: undefined });
  const c = new QueueContinuation(more, [track("a")], append, status);
  await Promise.all([c.load(), c.load()]); expect(more).toHaveBeenCalledTimes(1);
  await c.load(); expect(more).toHaveBeenCalledTimes(1);
  await c.load(true); expect(more).toHaveBeenCalledTimes(2); expect(append).toHaveBeenCalledExactlyOnceWith([track("b")]);
  const repeat = vi.fn(async () => ({ tracks: [track("a")], more: repeat }));
  const d = new QueueContinuation(repeat, [track("a")], append, status);
  await d.load(); expect(d.available).toBe(false); await d.load(); expect(repeat).toHaveBeenCalledTimes(1);
});
it("continues next at the page boundary without dropping queued extras", async () => {
  const p = new Playback(null, () => {}); await p.play(track("a")); p.setContinuationEnabled(true);
  p.setContinuation(async () => ({ tracks: [track("b")] }));
  await p.next(); expect(p.getState().track?.id).toBe("b"); p.quit();
});
it("keeps shuffle order and avoids automatic requests during repeat-one", async () => {
  const p = new Playback(null, () => {});
  await p.play(track("a"), [track("a"), track("b"), track("c")]);
  p.toggleShuffle(); const order = p.queueEntries().map(e => e.track.id);
  p.cycleRepeat(); p.cycleRepeat();
  const more = vi.fn(async () => ({ tracks: [track("d")] }));
  p.setContinuationEnabled(true); p.setContinuation(more); expect(more).not.toHaveBeenCalled();
  await p.retryContinuation();
  expect(p.queueEntries().map(e => e.track.id)).toEqual([...order, "d"]);
  expect(p.getState().track?.id).toBe("a"); p.quit();
});
it("bounds the number of pages and unique tracks", async () => {
  let id = 0; const append = vi.fn();
  const more = vi.fn(async () => ({ tracks: [track(String(++id))], more }));
  const c = new QueueContinuation(more, [], append, () => {});
  for (let i = 0; i < 101; i++) await c.load();
  expect(more).toHaveBeenCalledTimes(100); expect(c.available).toBe(false);
  const huge = new QueueContinuation(async () => ({ tracks: Array.from({ length: 10002 }, (_, i) => track(String(i))), more }), [], append, () => {});
  await huge.load(); expect(append.mock.lastCall![0]).toHaveLength(10000); expect(huge.available).toBe(false);
});
it("settles cancellation even if the provider ignores its abort signal", async () => {
  const append = vi.fn(), status = vi.fn();
  const c = new QueueContinuation(() => new Promise(() => {}), [], append, status);
  const work = c.load(); c.cancel(); await work;
  expect(append).not.toHaveBeenCalled(); expect(status).toHaveBeenCalledTimes(1);
});
it("times out a stalled page without adding tracks or repeatedly retrying", async () => {
  const controller = new AbortController();
  const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  try {
    const more = vi.fn(() => new Promise<QueuePage>(() => {})), append = vi.fn(), status = vi.fn();
    const c = new QueueContinuation(more, [], append, status);
    const work = c.load(); expect(timeout).toHaveBeenCalledWith(20000); controller.abort(); await work;
    expect(append).not.toHaveBeenCalled(); expect(status).toHaveBeenLastCalledWith(expect.stringContaining("C retries"));
    await c.load(); expect(more).toHaveBeenCalledTimes(1); c.cancel();
  } finally { timeout.mockRestore(); }
});
