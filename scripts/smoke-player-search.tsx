// Generated silent audio + read-only fake library; never uses the real profile.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execa } from "execa";
import { render, cleanup } from "ink-testing-library";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-player-search-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const { PlayerSearch } = await import("../src/ui/components/PlayerSearch");
const { StoreContext } = await import("../src/ui/store");
const { makeStore, makeFakeLibrary } = await import("./fake-data");
const track = { id: "fixture", source: "local" as const, sourceTrackId: "fixture", title: "Search fixture",
  filePath: path.join(profile, "fixture.wav"), addedAt: new Date().toISOString() };
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "12", track.filePath]);
const playback = new Playback("mpv", () => { throw Error("Unexpected fallback"); });
const pause = (ms = 100) => new Promise(r => setTimeout(r, ms));
const until = async (condition: () => boolean) => {
  const end = Date.now() + 5000;
  while (!condition()) { if (Date.now() > end) throw Error("Playback timeout"); await pause(25); }
};
try {
  await playback.setVolume(0); await playback.play(track, [track]);
  await until(() => playback.getState().position > 0.2);
  const store = makeStore({ playback, library: makeFakeLibrary([track]) });
  let closed = false;
  const view = render(<StoreContext.Provider value={store}><PlayerSearch width={70} height={14} active
    onClose={() => { closed = true; }} onDownload={() => { throw Error("Unexpected download"); }} /></StoreContext.Provider>);
  await pause(); const before = playback.getState().position;
  view.stdin.write("l: Search fixture"); await pause(); view.stdin.write("\r"); await pause(1200);
  assert.match(view.lastFrame()!, /Search fixture/);
  assert.ok(playback.getState().position > before + 0.5);
  assert.equal(playback.getState().paused, false); assert.equal(playback.getState().list.length, 1);
  view.stdin.write("A"); await pause(); assert.equal(playback.getState().list.length, 2);
  view.stdin.write("P"); await pause(); assert.equal(playback.getState().list.length, 3);
  view.stdin.write("\r"); await pause(); await until(() => playback.getState().index === 1 && !playback.getState().loading);
  view.stdin.write("\u001b"); await pause(); assert.equal(closed, true);
  assert.equal(playback.getState().volume, 0);
  console.log("PASS: real muted mpv advances during local player search; append/next/play/Esc; no downloads");
  console.log(`Isolated fixtures retained: ${profile}`);
} finally { cleanup(); playback.quit(); }
