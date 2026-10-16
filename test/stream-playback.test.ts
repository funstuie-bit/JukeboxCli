import { beforeEach, describe, expect, it, vi } from "vitest";
import { Playback } from "../src/player/playback";
import { MpvPlayer } from "../src/player/mpv";
import { StreamResolutionError, type ResolvedMedia, type StreamTrack } from "../src/player/media";
import { persistListeningSession, readSession, sessionFile } from "../src/player/session";
import { readFileSync, writeFileSync } from "node:fs";
import { trackFromUrl } from "../src/player/url";

vi.mock("../src/player/mpv", async () => {
  const { EventEmitter } = await import("node:events");
  return { MpvPlayer: class extends EventEmitter {
    static current: any;
    loads: string[] = []; mediaLoads: ResolvedMedia[] = []; next: { media: ResolvedMedia; token: number } | null = null;
    fail = 0; volume = 100;
    constructor() { super(); (this.constructor as any).current = this; }
    setInitialVolume(v: number) { this.volume = v; }
    async getVolume() { return this.volume; }
    async loadMedia(media: ResolvedMedia) { this.mediaLoads.push(media); this.loads.push(media.url); if (this.fail-- > 0) throw Error("signed URL rejected"); }
    async clearNext() { this.next = null; }
    async preloadNext(media: ResolvedMedia, token: number, signal: AbortSignal) { if (!signal.aborted) this.next = { media, token }; }
    async playPrepared(token: number) {
      if (this.next?.token !== token) return false;
      this.next = null; this.emit("advanced", token); return true;
    }
    async stop() { this.next = null; }
    async command() { return 1; }
    seekAbsolute = vi.fn(async () => {});
    seekRelative = vi.fn(async () => {});
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
  it("offers an explicit cookie retry for one item, preserving mode/position/queue without persisting consent", async () => {
    const resolver = vi.fn(async (_track, _signal, _fresh, _mode, options) => {
      if (!options?.withoutCookies) throw new StreamResolutionError("cookies");
      return media("public");
    });
    const p = new Playback("fixture", undefined, resolver);
    await p.retryWithoutCookies(); expect(resolver).not.toHaveBeenCalled();
    await p.play(a, [a,b], 0, false, false, "video", 37);
    expect(p.getState()).toMatchObject({cookieRetryAvailable:true,withoutCookies:false,mode:"video",position:37});
    expect(resolver.mock.calls.filter(c=>c[0].id===a.id)).toHaveLength(1);
    await p.retryWithoutCookies();
    expect(p.getState()).toMatchObject({error:undefined,cookieRetryAvailable:false,withoutCookies:true,mode:"video",position:37,paused:false});
    expect(p.getState().list.map(t=>t.id)).toEqual([a.id,b.id]);
    expect(engine().mediaLoads.at(-1)).toMatchObject({mode:"video",startPosition:37});
    expect(JSON.stringify(p.session())).not.toMatch(/withoutCookies|cookieRetryAvailable/);
    await p.setPlaybackMode("audio");
    expect(p.getState().withoutCookies).toBe(true);
    await p.next();
    expect(p.getState()).toMatchObject({track:b,withoutCookies:false,cookieRetryAvailable:true});
    const last = resolver.mock.calls.filter(c=>c[0].id===b.id).at(-1)!;
    expect(last[4]).toBeUndefined(); p.quit();
  });
  it("does not offer cookie recovery for a source restriction or a failed anonymous retry", async () => {
    for (const reason of ["blocked", "cookies"] as const) {
      const resolver = vi.fn(async () => { throw new StreamResolutionError(reason); });
      const p = new Playback("fixture",undefined,resolver);
      await p.play(a);
      if (reason === "cookies") await p.retryWithoutCookies();
      expect(p.getState().cookieRetryAvailable).toBe(false);
      const count = resolver.mock.calls.length;
      await p.retryWithoutCookies(); expect(resolver.mock.calls).toHaveLength(count); p.quit();
    }
  });
  it("keeps explicit consent for repeat-one preparation of the same item", async () => {
    const resolver = vi.fn(async (_track,_signal,_fresh,_mode,options) => {
      if (!options?.withoutCookies) throw new StreamResolutionError("cookies");
      return media("repeat-public");
    });
    const p = new Playback("fixture",undefined,resolver);
    await p.play(a); await p.retryWithoutCookies();
    p.cycleRepeat(); p.cycleRepeat(); await settle();
    engine().emit("ended"); await settle();
    expect(p.getState()).toMatchObject({track:a,withoutCookies:true,error:undefined,repeat:"one"});
    expect(resolver.mock.calls.at(-1)![4]).toEqual({withoutCookies:true}); p.quit();
  });
  it("preserves known duration through empty resolver and mpv reports, but accepts a real duration", async () => {
    const p = new Playback("fixture", undefined, async () => ({ ...media("a"), metadata: { title: "A", durationSec: undefined } }));
    await p.play({ ...a, durationSec: 259 });
    expect(p.getState().duration).toBe(259);
    for (const value of [0, -1, NaN, Infinity, null]) engine().emit("property", "duration", value);
    expect(p.getState().duration).toBe(259);
    engine().emit("property", "duration", 260.5);
    expect(p.getState().duration).toBe(260);
    await p.play(b); expect(p.getState().duration).toBe(0);
    p.quit();
  });
  it("keeps live stations out of prefetch, blocks seeking, reconnects and retains a disconnected queue", async () => {
    const radio = trackFromUrl("https://example.com/live", true);
    const resolver = vi.fn(async t => media(t.sourceTrackId));
    const p = new Playback("fixture", undefined, resolver);
    await p.play(local, [local, radio]); await settle();
    expect(resolver).not.toHaveBeenCalled(); expect(engine().next).toBeNull();
    await p.next(); await settle(); expect(p.getState().track?.id).toBe(radio.id);
    p.enqueue(b); await settle(); expect(engine().next).toBeNull();
    engine().emit("property", "duration", 1234);
    engine().emit("property", "metadata", { "icy-title": "Artist - song" });
    expect(p.getState().duration).toBe(0); expect(p.getState().broadcastTitle).toBe("Artist - song");
    await p.seek(15); await p.restart();
    expect(engine().seekRelative).not.toHaveBeenCalled(); expect(engine().seekAbsolute).not.toHaveBeenCalled();
    await p.togglePause(); expect(p.getState().paused).toBe(true);
    await p.togglePause(); expect(resolver.mock.calls).toHaveLength(2);
    expect(p.getState().paused).toBe(false);
    engine().emit("property", "time-pos", 72); expect(p.session().position).toBe(0);
    const saver = persistListeningSession(p); saver.close();
    expect(readSession()?.streams?.[radio.id]?.streamType).toBe("radio");
    const q = new Playback("fixture", undefined, resolver);
    await q.restoreSession({ ...p.session(), position: 100 }, () => undefined);
    expect(q.getState().paused).toBe(true); expect(q.getState().position).toBe(0);
    expect(resolver.mock.calls).toHaveLength(2);
    engine().emit("ended"); await settle();
    expect(p.getState().error).toContain("Live broadcast"); expect(p.getState().list).toHaveLength(3);
    await p.next(); expect(p.getState().track?.id).toBe(b.id);
    expect(p.getState().broadcastTitle).toBeUndefined();
    p.quit(); q.quit();
  });
  it("enriches URL metadata, detects live YouTube and does not preload it", async () => {
    const p = new Playback("fixture", undefined, async () => ({ ...media("a"), metadata: { title: "Live music", isLive: true } }));
    await p.play(local, [local, a]); await settle();
    expect(engine().next).toBeNull();
    expect(p.getState().list[1]?.title).toBe("Live music");
    await p.next(); await p.seek(15);
    expect(engine().seekRelative).not.toHaveBeenCalled();
    expect(p.session().streams?.[a.id]?.isLive).toBe(true);
    p.quit();
  });
  it("respects mpv non-seekable audio even when not labelled radio", async () => {
    const p = new Playback("fixture", undefined, async () => media("a"));
    await p.play(a); engine().emit("property", "seekable", false);
    await p.seek(15); await p.restart();
    expect(engine().seekRelative).not.toHaveBeenCalled(); expect(engine().seekAbsolute).not.toHaveBeenCalled(); p.quit();
  });
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
    const resolver = vi.fn(async (..._args: any[]) => media("a"));
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

describe("audio/video modes", () => {
  it("passes separate streams to one engine and keeps signed links out of sessions and errors", async () => {
    const resolver = vi.fn(async (_t, _signal, _fresh, mode) => ({ ...media("video"),
      ...(mode === "video" ? { audioUrl: "https://media.example/audio?sig=audio-private" } : {}) }));
    const p = new Playback("fixture", undefined, resolver);
    await p.play(a, [a, b], 0, true, false, "video");
    const m = engine();
    expect(m.mediaLoads.at(-1)).toMatchObject({ audioUrl: "https://media.example/audio?sig=audio-private", mode: "video" });
    const saver = persistListeningSession(p); saver.close();
    expect(readFileSync(sessionFile, "utf8")).not.toMatch(/audioUrl|audio-private|temporary|headers/);
    await p.setPlaybackMode("audio");
    expect(engine()).toBe(m); expect(m.mediaLoads.at(-1)).not.toHaveProperty("audioUrl");
    expect(p.getState().list.map(t => t.id)).toEqual([a.id, b.id]); p.quit();
  });
  it("preserves safe format and authentication failure reasons in video mode", async () => {
    for (const reason of ["format", "blocked", "timeout"] as const) {
      const error = new StreamResolutionError(reason);
      const p = new Playback("fixture", undefined, async () => { throw error; });
      await p.play(a, [a, b], 0, false, false, "video");
      expect(p.getState().error).toContain(error.message);
      expect(p.getState().error).toContain("Press W");
      expect(p.getState().list).toEqual([a, b]); p.quit();
    }
  });
  it("refreshes both links once if the separate audio fails, then reports that reason", async () => {
    const resolver = vi.fn(async (_track, _signal, fresh) => {
      const m = engine();
      m.command = async (args: unknown[]) => args[1] === "aid" ? false : 1;
      return { ...media(fresh ? "renewed" : "first"), audioUrl: "https://media.example/audio?sig=private-audio" };
    });
    const p = new Playback("fixture", undefined, resolver);
    await p.play(a, [a, b], 0, false, false, "video");
    expect(resolver.mock.calls.map(call => call[2])).toEqual([false, true]);
    expect(engine().mediaLoads).toHaveLength(2);
    expect(p.getState().error).toContain("separate audio stream");
    expect(p.getState().error).not.toMatch(/https:|sig=|private-audio/);
    expect(p.getState().list).toEqual([a, b]); p.quit();
  });
  it("switches in one engine, preserves position/pause/volume, then defaults queued entries to audio", async () => {
    const resolver = vi.fn(async (..._args: any[]) => media("a"));
    const p = new Playback("fixture", undefined, resolver);
    await p.play(a, [a, b], 0, true);
    const m = engine();
    m.emit("property", "time-pos", 42); m.emit("property", "volume", 37);
    m.volume = 37;
    await p.setPlaybackMode("video");
    expect(engine()).toBe(m);
    expect(resolver.mock.calls.some(call => call[3] === "video")).toBe(true);
    expect(m.mediaLoads.at(-1)).toMatchObject({ mode: "video", startPosition: 42 });
    expect(p.getState()).toMatchObject({ mode: "video", paused: true, volume: 37 });
    await p.setPlaybackMode("audio");
    expect(m.mediaLoads.at(-1)).toMatchObject({ mode: "audio", startPosition: 42 });
    await p.next(); expect(p.getState().mode).toBe("audio"); p.quit();
  });
  it("window closure stops the current item without clearing the queue or advancing", async () => {
    const p = new Playback("fixture", undefined, async () => media("a"));
    await p.play(a, [a, b], 0, false, false, "video");
    engine().emit("quit");
    expect(p.getState()).toMatchObject({ track: null, paused: true, loading: false });
    expect(p.getState().list).toHaveLength(2); p.quit();
  });
  it("offers audio when the source has no video and never opens an external player", async () => {
    const opener = vi.fn(); const p = new Playback("fixture", opener, async () => media("a"));
    await p.play(a); engine().command = async () => false;
    await p.setPlaybackMode("video");
    expect(p.getState().error).toContain("try audio"); expect(opener).not.toHaveBeenCalled();
    await p.setPlaybackMode("audio"); expect(p.getState().error).toBeUndefined(); p.quit();
  });
});

it("plays a saved YouTube queue occurrence as video, then returns to the local audio without replacing the queue", async () => {
  const saved = { ...local, source: "youtube" as const, sourceTrackId: "abcdefghijk", filePath: "/music/download.mp3" };
  const resolver = vi.fn(async () => media("original-video"));
  const p = new Playback("fixture", undefined, resolver);
  await p.play(saved, [saved, saved], 0);
  await p.playQueueIndex(1, "video");
  expect(resolver).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "stream", streamUrl: "https://www.youtube.com/watch?v=abcdefghijk" }), expect.any(AbortSignal), false, "video");
  expect(engine().mediaLoads.at(-1)).toMatchObject({ mode: "video", url: media("original-video").url });
  expect(p.getState()).toMatchObject({ index: 1, list: [saved, saved], track: saved });
  resolver.mockClear();
  await p.setPlaybackMode("audio");
  expect(engine().mediaLoads.at(-1)).toMatchObject({ mode: "audio", url: saved.filePath });
  expect(resolver).not.toHaveBeenCalled();
  expect(p.getState().index).toBe(1); p.quit();
});
