import { describe, it, expect, vi } from "vitest";
import { mediaAction, mediaBindings, dispatchMediaAction } from "../src/player/media-keys";
describe("native media-key bridge", () => {
  it("allows only namespaced known commands and never binds mpv playlist changes", () => {
    expect(mediaAction(["jukeboxcli-media", "next"])).toBe("next");
    for (const args of [null, ["other", "next"], ["jukeboxcli-media", "quit"], ["jukeboxcli-media", "next", "extra"]]) expect(mediaAction(args)).toBeUndefined();
    expect(mediaBindings).toContain("NEXT script-message jukeboxcli-media next");
    expect(mediaBindings).not.toContain("playlist-next");
  });
  it("routes transport idempotently and keeps stop non-destructive", async () => {
    let paused = false;
    const player = { getState: () => ({ paused, loading: false, track: {} }),
      togglePause: vi.fn(async () => { paused = !paused; }), next: vi.fn(async () => {}), prev: vi.fn(async () => {}), seek: vi.fn(async () => {}) };
    await dispatchMediaAction(player, "play"); expect(player.togglePause).not.toHaveBeenCalled();
    await dispatchMediaAction(player, "pause"); await dispatchMediaAction(player, "pause"); expect(player.togglePause).toHaveBeenCalledTimes(1);
    await dispatchMediaAction(player, "play"); expect(paused).toBe(false);
    await dispatchMediaAction(player, "next"); await dispatchMediaAction(player, "previous");
    expect(player.next).toHaveBeenCalledOnce(); expect(player.prev).toHaveBeenCalledOnce();
    await dispatchMediaAction(player, "forward"); expect(player.seek).toHaveBeenCalledWith(15);
    player.getState = () => ({ paused, loading: true, track: {} });
    await dispatchMediaAction(player, "next"); expect(player.next).toHaveBeenCalledOnce();
  });
});
