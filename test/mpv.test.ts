import { describe, it, expect, vi } from "vitest";
import { MpvPlayer } from "../src/player/mpv";

describe("MpvPlayer idle-command gating", () => {
  // The crash was an mpv "error running command" reply to a seek/pause sent
  // while no file was loaded. With the `loaded` gate those commands must return
  // early, never spawning mpv (here a bogus path) and never rejecting.
  it("seek and pause are safe no-ops when nothing is loaded", async () => {
    const player = new MpvPlayer("/no/such/mpv/binary");
    await expect(player.seekRelative(5)).resolves.toBeUndefined();
    await expect(player.seekAbsolute(10)).resolves.toBeUndefined();
    await expect(player.togglePause()).resolves.toBeUndefined();
    player.quit();
  });
});

it.each([false, 1])("repairs missing HLS external audio only when aid is %s", async aid => {
  const player = new MpvPlayer("/no/such/mpv/binary");
  const command = vi.spyOn(player, "command").mockImplementation(async args => {
    if (args[0] === "loadfile") queueMicrotask(() => player.emit("loaded"));
    if (args[0] === "get_property" && args[1] === "aid") return aid;
  });
  try {
    await player.loadMedia({ url: "https://cdn.example/video.m3u8", audioUrl: "https://cdn.example/audio?sig=ephemeral", mode: "video", expiresAt: Infinity }, true);
    const additions = command.mock.calls.filter(([args]) => args[0] === "audio-add");
    expect(additions).toHaveLength(aid ? 0 : 1);
    if (!aid) expect(additions[0]).toEqual([["audio-add", "https://cdn.example/audio?sig=ephemeral", "select"], 20_000]);
    expect(command.mock.calls[0]![0]).toEqual(["set_property", "pause", true]);
  } finally { player.quit(); }
});

it("does not hide an external soundtrack attachment failure", async () => {
  const player = new MpvPlayer("/no/such/mpv/binary");
  vi.spyOn(player, "command").mockImplementation(async args => {
    if (args[0] === "loadfile") queueMicrotask(() => player.emit("loaded"));
    if (args[0] === "get_property") return false;
    if (args[0] === "audio-add") throw Error("error running command");
  });
  try {
    await expect(player.loadMedia({ url: "https://cdn.example/video.m3u8", audioUrl: "https://cdn.example/audio", mode: "video", expiresAt: Infinity })).rejects.toThrow("separate audio stream");
  } finally { player.quit(); }
});

it("loads separate audio with video and clears external audio on the next audio or combined load", async () => {
  const player = new MpvPlayer("/no/such/mpv/binary");
  const command = vi.spyOn(player, "command").mockImplementation(async args => {
    if (args[0] === "loadfile") queueMicrotask(() => player.emit("loaded"));
  });
  try {
    await player.loadMedia({ url: "https://cdn.example/picture", audioUrl: "https://cdn.example/sound?range=1,2", mode: "video", expiresAt: Infinity }, true);
    await player.loadMedia({ url: "/music/local.mp3", mode: "audio", expiresAt: Infinity }, true);
    await player.loadMedia({ url: "https://cdn.example/combined", mode: "video", expiresAt: Infinity }, true);
    const loads = command.mock.calls.filter(([args]) => args[0] === "loadfile").map(([args]) => args);
    expect(loads[0]).toEqual(["loadfile", "https://cdn.example/picture", "replace", -1, expect.objectContaining({ "audio-files-clr": "", "audio-files-append": "https://cdn.example/sound?range=1,2", vid: "auto" })]);
    expect(loads[1]![4]).toMatchObject({ "audio-files-clr": "", vid: "no" });
    expect(loads[2]![4]).toMatchObject({ "audio-files-clr": "", vid: "auto" });
    expect(loads[1]![4]).not.toHaveProperty("audio-files-append");
    expect(loads[2]![4]).not.toHaveProperty("audio-files-append");
  } finally { player.quit(); }
});
