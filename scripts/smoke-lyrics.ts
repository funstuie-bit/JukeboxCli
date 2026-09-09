// Real mpv timing with invented local LRC and generated silence; no real library.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { execa } from "execa";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-lyrics-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const { createLyricsService, lyricIndex } = await import("../src/player/lyrics");
const track = { id: "fixture", source: "local" as const, sourceTrackId: "fixture", title: "Fixture",
  filePath: path.join(profile, "fixture.wav"), addedAt: new Date().toISOString() };
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "5", track.filePath]);
writeFileSync(path.join(profile, "fixture.lrc"), "[00:00] Opening fixture\n[00:01]<00:01> Middle <00:02> fixture\n[00:03] Closing fixture");
const result = await createLyricsService({ fetcher: async () => { throw Error("Unexpected network"); } })(track,
  { online: false, signal: new AbortController().signal });
assert.equal(result.lyrics?.source, "Local LRC");
const lines = result.lyrics!.lines;
const p = new Playback("mpv", () => { throw Error("Unexpected fallback"); });
const waitFor = async (fn: () => boolean) => {
  const deadline = Date.now() + 5000;
  while (!fn()) {
    if (Date.now() > deadline) throw Error("mpv timing timed out");
    await new Promise(r => setTimeout(r, 25));
  }
};
try {
  await p.setVolume(0); await p.play(track, [track], 0, true);
  await waitFor(() => p.getState().duration === 5);
  assert.equal(lyricIndex(lines, p.getState().position), 0);
  await p.seek(2); await waitFor(() => p.getState().position === 2);
  assert.equal(lyricIndex(lines, p.getState().position), 1);
  assert.equal(lyricIndex(lines[1]!.words!, p.getState().position), 1);
  await new Promise(r => setTimeout(r, 300));
  assert.equal(p.getState().paused, true); assert.equal(lyricIndex(lines, p.getState().position), 1);
  await p.togglePause(); await waitFor(() => p.getState().position >= 3);
  assert.equal(lyricIndex(lines, p.getState().position), 2);
  await p.togglePause(); await p.seek(-3); await waitFor(() => p.getState().position < 1);
  assert.equal(lyricIndex(lines, p.getState().position), 0);
  console.log("PASS: local enhanced LRC, real muted mpv, seek forwards/backwards, paused timing, word and advancing line sync");
  console.log(`Isolated fixture profile retained: ${profile}`);
} finally { p.quit(); }
