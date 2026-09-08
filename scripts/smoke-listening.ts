// Real mpv acceptance, silent generated fixtures, isolated profile. No downloads
// or changes to the user's library. Run: npx tsx scripts/smoke-listening.ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execa } from "execa";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-mpv-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const { readSession, persistListeningSession } = await import("../src/player/session");
const tracks = ["first", "second"].map(id => ({ id, title: id, source: "local" as const,
  sourceTrackId: id, filePath: path.join(profile, `${id}.wav`), addedAt: new Date().toISOString() }));
for (const t of tracks) {
  await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "3", t.filePath]);
}
const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("mpv state timed out");
    await new Promise(r => setTimeout(r, 25));
  }
};
const p = new Playback("mpv", () => { throw new Error("unexpected external fallback"); });
const q = new Playback("mpv", () => { throw new Error("unexpected external fallback"); });
try {
  await p.setVolume(0);
  await p.play(tracks[0]!, tracks, 0, true);
  await waitFor(() => p.getState().duration === 3);
  assert.equal(p.getState().engine, "mpv");
  assert.equal(p.getState().paused, true);
  await p.seek(1); await waitFor(() => p.getState().position === 1);
  p.toggleShuffle(); p.cycleRepeat();
  const saver = persistListeningSession(p); saver.close();
  const saved = readSession(); assert(saved); p.quit();
  await q.restoreSession(saved, id => tracks.find(t => t.id === id));
  await waitFor(() => q.getState().position === 1 && q.getState().duration === 3);
  assert.equal(q.getState().paused, true);
  assert.equal(q.getState().volume, 0);
  assert.deepEqual(q.session().order, saved.order);
  await q.next(); await waitFor(() => q.getState().track?.id === "second");
  await q.togglePause(); assert.equal(q.getState().paused, true);
  await q.stop(); q.enqueue(tracks[0]!); await q.togglePause();
  assert.equal(q.getState().track?.id, "first"); assert.equal(q.getState().paused, false);
  console.log("PASS: real mpv load, paused restore, position, volume, shuffle, repeat, next/pause and start-after-clear");
  console.log(`Isolated fixture profile retained: ${profile}`);
} finally { p.quit(); q.quit(); }
