import { beforeEach, describe, expect, it, vi } from "vitest";
import { Playback } from "../src/player/playback";
import { MpvPlayer } from "../src/player/mpv";
import type { ResolvedMedia, StreamTrack } from "../src/player/media";
import { persistListeningSession, readSession, sessionFile } from "../src/player/session";
import { readFileSync, writeFileSync } from "node:fs";

vi.mock("../src/player/mpv", async () => {
  const { EventEmitter } = await import("node:events");
  return { MpvPlayer: class extends EventEmitter {
    static current: any;
    loads: string[] = []; next: { media: ResolvedMedia; token: number } | null = null;
    fail = 0; volume = 100;
    constructor() { super(); (this.constructor as any).current = this; }
    setInitialVolume(v: number) { this.volume = v; }
    async getVolume() { return this.volume; }
    async loadMedia(media: ResolvedMedia) { this.loads.push(media.url); if (this.fail-- > 0) throw Error("signed URL rejected"); }
    async clearNext() { this.next = null; }
    async preloadNext(media: ResolvedMedia, token: number, signal: AbortSignal) { if (!signal.aborted) this.next = { media, token }; }
    async playPrepared(token: number) {
      if (this.next?.token !== token) return false;
      this.next = null; this.emit("advanced", token); return true;
    }
    async stop() { this.next = null; }
    async command() {}
    async seekAbsolute() {}
    quit() {}
  } };
});
const engine = () => (MpvPlayer as any).current;
const stream = (id: string): StreamTrack => ({ kind: "stream", id: `stream:youtube:${id}`, title: id,
  source: "youtube", sourceTrackId: id, addedAt: "2026-09-07", streamUrl: `https://music.youtube.com/watch?v=${id}` });
const a = stream("a"), b = stream("b"), c = stream("c");
const local = { id: "local", title: "local", source: "local" as const, sourceTrackId: "local", filePath: "/audio/local", addedAt: "2026-09-07" };
const media = (id: string): ResolvedMedia => ({ url: `https://media.example/${id}?secret=temporary`, expiresAt: Date.now() + 60_000 });
const settle = () => new Promise(r => setTimeout(r, 5));
beforeEach(() => { (MpvPlayer as any).current = undefined; });

describe("stream playback", () => {
  it("prepares one next entry, honours play-next edits, and advances without reloading", async () => {
    const resolver = vi.fn(async t => media(t.sourceTrackId));
    const p = new Playback("fixture", undefined, resolver);
    await p.play(a, [a, b, local]); await settle();
    expect(engine().next.media.url).toContain("/b?");
    p.enqueue(c, true); await settle(); expect(engine().next.media.url).toContain("/c?");
    await p.next(); expect(p.getState().track).toBe(c); await settle();
    expect(engine().loads).toHaveLength(1);
    expect(p.session().backStack).toEqual([0]);
    engine().emit("ended"); await settle(); expect(p.getState().track).toBe(b);
    await settle(); expect(engine().next.media.url).toBe(local.filePath);
    p.quit();
  });
  it("invalidates preparation on repeat, shuffle and removal", async () => {
    const p = new Playback("fixture", undefined, async t => media(t.sourceTrackId));
    await p.play(a, [a, b, c]); await settle();
    p.cycleRepeat(); p.cycleRepeat(); await settle(); expect(engine().next.media.url).toContain("/a?");
    p.cycleRepeat(); p.toggleShuffle(); await settle();
    expect(engine().next.media.url).toContain(`/${p.upNext(1)[0]!.sourceTrackId}?`);
    const next = p.queueEntries().find(e => e.track === p.upNext(1)[0])!;
    await p.removeQueue(next.index); await settle();
    expect(engine().next.media.url).not.toContain(`/${next.track.sourceTrackId}?`);
    p.quit();
  });
  it("refreshes a rejected stream once without discarding its queue", async () => {
    const resolver = vi.fn(async (_t, _signal, fresh) => {
      if (!fresh) engine().fail = 1;
      return media(fresh ? "fresh" : "expired");
    });
    const p = new Playback("fixture", undefined, resolver);
    await p.play(a);
    expect(resolver.mock.calls.map(c => c[2])).toEqual([false, true]);
    expect(engine().loads).toHaveLength(2); expect(p.getState().error).toBeUndefined();
    p.quit();
  });
  it("late URL resolution cannot replace a newer local selection", async () => {
    let finish!: (m: ResolvedMedia) => void;
    const p = new Playback("fixture", undefined, () => new Promise(r => { finish = r; }));
    const pending = p.play(a); await settle();
    await p.play(local); finish(media("late")); await pending;
    expect(engine().loads).toEqual([local.filePath]); expect(p.getState().track).toBe(local);
    p.quit();
  });
  it("errors retain the queue and never expose signed media URLs", async () => {
    const p = new Playback("fixture", undefined, async () => { throw Error("https://media.example/?secret=bad"); });
    await p.play(a, [a, b]);
    expect(p.getState().list).toHaveLength(2);
    expect(p.getState().error).toContain("Could not play");
    expect(p.getState().error).not.toContain("secret");
    p.quit();
  });
  it("remote sessions restore offline and persist metadata, not media credentials", async () => {
    const resolver = vi.fn(async () => media("a"));
    const p = new Playback("fixture", undefined, resolver);
    p.enqueue({ ...a, headers: { Cookie: "private" }, resolvedUrl: media("a").url } as StreamTrack);
    const saver = persistListeningSession(p); saver.close();
    const raw = readFileSync(sessionFile, "utf8"); expect(raw).not.toMatch(/private|secret|headers|resolvedUrl/);
    const saved = readSession()!;
    const q = new Playback("fixture", undefined, resolver);
    await q.restoreSession({ ...saved, index: 0, position: 20 }, () => undefined);
    expect(resolver).not.toHaveBeenCalled(); expect(q.getState().paused).toBe(true);
    expect(q.getState().position).toBe(20); expect(q.getState().track?.id).toBe(a.id);
    for (const value of [{ ...a, artist: {} }, { ...a, thumbnailUrl: "file:///private" }]) {
      writeFileSync(sessionFile, JSON.stringify({ ...saved, streams: { [a.id]: value } })); expect(readSession()).toBeNull();
    }
    writeFileSync(sessionFile, JSON.stringify({ ...saved, version: 1, streams: undefined }));
    expect(readSession()?.version).toBe(1);
    p.quit(); q.quit();
  });
});
