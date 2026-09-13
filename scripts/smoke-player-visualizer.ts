// Exercise the production MpvPlayer visualiser path with a generated, muted tone.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";

process.env.JUKEBOXCLI_VISUALIZER = "1";
const { MpvPlayer } = await import("../src/player/mpv");
const dir = mkdtempSync(path.join(os.tmpdir(), "jukeboxcli-player-spectrum-"));
const file = path.join(dir, "tone.wav");
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i",
  "sine=frequency=125:sample_rate=48000:duration=2", "-c:a", "pcm_f32le", file]);

const player = new MpvPlayer("mpv");
player.setInitialVolume(0);
let levels: number[] | undefined;
const ready = new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("production visualiser emitted no usable samples")), 6000);
  player.on("spectrum", (next: number[]) => {
    if (next.some(db => db > -80)) { levels = next; clearTimeout(timer); resolve(); }
  });
});

try {
  await player.loadFile(file);
  await ready;
  assert(levels);
  assert.equal(levels.indexOf(Math.max(...levels)), 1, "125 Hz must peak in the 125 Hz band");
  console.log(`PASS: production mpv visualiser path (${dir})`);
} finally {
  player.quit();
}
