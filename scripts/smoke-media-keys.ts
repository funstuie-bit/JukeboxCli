import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execa } from "execa";
const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-media-keys-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const file = path.join(profile, "fixture.wav");
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "20", file]);
const tracks = [0, 1, 2].map(i => ({ id: `fixture:${i}`, source: "local" as const, sourceTrackId: String(i),
  title: `Fixture ${i}`, artist: "JukeboxCli test", filePath: file, addedAt: new Date().toISOString() }));
const player = new Playback("mpv", () => { throw Error("Unexpected fallback"); });
const until = async (fn: () => boolean) => {
  const deadline = Date.now() + 6000;
  while (!fn()) { if (Date.now() > deadline) throw Error("Media-key state timeout"); await new Promise(r => setTimeout(r, 30)); }
};
try {
  await player.setVolume(0); await player.play(tracks[0]!, tracks, 0, true);
  const mpv = (player as unknown as { mpv: import("../src/player/mpv").MpvPlayer }).mpv;
  assert.ok(mpv);
  await mpv.command(["keypress", "PLAYONLY"]); await until(() => !player.getState().paused);
  await mpv.command(["keypress", "PAUSEONLY"]); await until(() => player.getState().paused);
  await mpv.command(["keypress", "NEXT"]); await until(() => player.getState().index === 1 && !player.getState().loading);
  await mpv.command(["keypress", "NEXT"]); await until(() => player.getState().index === 2 && !player.getState().loading);
  await mpv.command(["keypress", "PREV"]); await until(() => player.getState().index === 1 && !player.getState().loading);
  await mpv.command(["keypress", "STOP"]); await until(() => player.getState().paused);
  assert.equal(player.getState().list.length, 3);
  assert.equal(await mpv.command(["get_property", "media-title"]), "JukeboxCli test · Fixture 1");
  assert.equal(player.getState().volume, 0);
  console.log("PASS: real mpv keypress → JukeboxCli play/pause/next/previous/stop-as-pause; queue and title preserved");
  console.log("Synthetic mpv key events, NOT physical keyboard or Control Centre acceptance.");
  console.log(`Isolated fixtures retained: ${profile}`);
} finally { player.quit(); }
