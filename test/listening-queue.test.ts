import { describe, it, expect } from "vitest";
import { Playback } from "../src/player/playback";
import { readSession, persistListeningSession, sessionFile } from "../src/player/session";
import { writeFileSync } from "node:fs";
import type { Track } from "../src/library/types";

const track = (id: string): Track => ({ id, title: id, source: "local", sourceTrackId: id,
  filePath: `/test/${id}.mp3`, addedAt: "2026-09-07" });
const list = [track("a"), track("b"), track("c")];
const ids = (p: Playback) => p.queueEntries().map(e => e.track.id);

describe("listening queue", () => {
  it("appends without playing and starts from space when idle", async () => {
    const opened: string[] = []; const p = new Playback(null, f => { opened.push(f); });
    p.enqueue(list[0]!); p.enqueue(list[1]!);
    expect(opened).toEqual([]); await p.togglePause();
    expect(p.getState().track?.id).toBe("a"); expect(ids(p)).toEqual(["a", "b"]);
  });
  it("play-next is next under shuffle and remains next after disabling shuffle", async () => {
    const p = new Playback(null, () => {}); await p.play(list[0]!, list); p.toggleShuffle();
    p.enqueue(track("x"), true); expect(p.upNext(1)[0]?.id).toBe("x");
    p.toggleShuffle(); expect(p.upNext(1)[0]?.id).toBe("x");
    await p.next(); await p.next(); expect(p.getState().track?.id).toBe("b");
  });
  it("one-off selection returns to the playlist and later selections keep extras", async () => {
    const p = new Playback(null, () => {}); await p.play(list[0]!, list);
    const x = track("x"); await p.selectTrack(x, [x]); expect(p.getState().track?.id).toBe("x");
    await p.next(); expect(p.getState().track?.id).toBe("b");
    p.enqueue(track("z")); await p.selectTrack(list[2]!, [...list]); expect(ids(p)).toContain("z");
  });
  it("moves and removes duplicate occurrences without deleting or interrupting current audio", async () => {
    const p = new Playback(null, () => {}); await p.play(list[0]!, list);
    p.enqueue(list[0]!); p.moveQueue(3, -1); expect(ids(p)).toEqual(["a", "b", "a", "c"]);
    await p.removeQueue(2); expect(ids(p)).toEqual(["a", "b", "c"]);
    expect(p.getState().track?.id).toBe("a"); await p.next(); expect(p.getState().track?.id).toBe("b");
  });
  it("removes the current entry and advances without skipping the following song", async () => {
    const p = new Playback(null, () => {}); await p.play(list[0]!, list);
    await p.removeQueue(0); expect(p.getState().track?.id).toBe("b");
    await p.next(); expect(p.getState().track?.id).toBe("c");
  });
  it("publishes shuffle order before notifying subscribers", async () => {
    const p = new Playback(null, () => {}); await p.play(list[0]!, list);
    p.on("state", () => expect(p.session().order.length).toBe(p.getState().list.length));
    p.enqueue(track("x"), true); p.toggleShuffle(); p.moveQueue(0, 1);
  });
});

describe("listening sessions", () => {
  it("atomically persists/restores queue and settings without launching external audio", async () => {
    const p = new Playback(null, () => {}); await p.play(list[1]!, list); p.toggleShuffle();
    p.cycleRepeat(); await p.setVolume(35); const saver = persistListeningSession(p); saver.close();
    const s = readSession()!; expect(s.volume).toBe(35); expect(s.repeat).toBe("all");
    const q = new Playback(null, () => { throw Error("must not open on restore"); });
    await q.restoreSession({ ...s, position: 47 }, id => list.find(t => t.id === id));
    expect(q.getState().paused).toBe(true); expect(q.getState().position).toBe(47);
    expect(q.session().order).toEqual(s.order); expect(ids(q)).toEqual(ids(p));
  });
  it("drops missing tracks and resolves changed file paths", async () => {
    const p = new Playback(null, () => {}); await p.play(list[1]!, list);
    const q = new Playback(null, () => {});
    await q.restoreSession(p.session(), id => id === "b" ? undefined : { ...track(id), filePath: `/moved/${id}` });
    expect(ids(q)).toEqual(["a", "c"]); expect(q.getState().track).toBeNull();
    expect(q.getState().list[0]?.filePath).toBe("/moved/a");
  });
  it("rejects malformed sessions and unknown versions", async () => {
    const p = new Playback(null, () => {}); const saver = persistListeningSession(p); saver.close();
    for (const patch of [{ version: 3 }, { position: -1 }, { ids: ["x"], order: [2] }, { volume: 101 }]) {
      writeFileSync(sessionFile, JSON.stringify({ ...p.session(), ...patch })); expect(readSession()).toBeNull();
    }
  });
});
