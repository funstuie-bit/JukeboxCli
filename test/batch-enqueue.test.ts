import { describe, expect, it, vi } from "vitest";
import { Playback } from "../src/player/playback";
import type { Track } from "../src/library/types";

const track = (id: string): Track => ({ id, source: "local", sourceTrackId: id, title: id, filePath: `/music/${id}.mp3`, addedAt: "2026-01-01" });

describe("batch queue insertion", () => {
  it.each([false, true])("queues next in selection order without restarting (shuffle %s)", async shuffle => {
    const opened = vi.fn();
    const player = new Playback(null, opened);
    const original = [track("current"), track("later")];
    await player.play(original[0]!, original);
    if (shuffle) player.toggleShuffle();
    const before = player.getState();
    player.enqueueMany([track("first"), track("second")], true);
    expect(player.getState().list.map(t => t.id)).toEqual(["current", "first", "second", "later"]);
    expect(player.getState().track).toBe(before.track);
    expect(player.getState().position).toBe(before.position);
    expect(player.getState().paused).toBe(before.paused);
    expect(opened).toHaveBeenCalledTimes(1);
    await player.next();
    expect(player.getState().track?.id).toBe("first");
    await player.next();
    expect(player.getState().track?.id).toBe("second");
    await player.prev();
    expect(player.getState().track?.id).toBe("first");
  });
  it("appends while idle without starting audio, allows intentional duplicates", () => {
    const opened = vi.fn();
    const player = new Playback(null, opened);
    player.enqueueMany([track("a"), track("b")], true);
    player.enqueueMany([track("a")]);
    player.enqueueMany([]);
    expect(player.getState().list.map(t => t.id)).toEqual(["a", "b", "a"]);
    expect(player.getState().index).toBe(-1);
    expect(player.getState().track).toBeNull();
    expect(opened).not.toHaveBeenCalled();
  });
});
