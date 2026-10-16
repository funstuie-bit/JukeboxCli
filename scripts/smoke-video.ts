// Real mpv acceptance: separate streams, mode changes, paused seek and cleanup.
// Offline by default. Supply a public YouTube URL to exercise the real resolver.
//   npx tsx scripts/smoke-video.ts [https://www.youtube.com/watch?v=...] [--cookie-retry]
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";

const directory = mkdtempSync(path.join(os.tmpdir(), "jukeboxcli-video-smoke-"));
process.env.JUKEBOXCLI_HOME = path.join(directory, "profile");
process.env.JUKEBOXCLI_MEDIA_KEYS = "0";
const { Playback } = await import("../src/player/playback");
const { trackFromUrl } = await import("../src/player/url");
const { createStreamResolver } = await import("../src/player/resolve");
const { ensureYtDlp } = await import("../src/bin/ytdlp-fetch");
const { defaultConfig } = await import("../src/config/config");
const { redactLog } = await import("../src/diagnostics/log");
const { findOnPath } = await import("../src/util/exec");
const mpv = await findOnPath("mpv");
assert(mpv, "Install mpv before running this check");
const picture = path.join(directory, "picture.mp4");
const sound = path.join(directory, "sound,stereo.wav");
await execa("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i",
  "testsrc2=size=480x270:rate=30:duration=20", "-an", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", picture]);
await execa("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i",
  "sine=frequency=125:sample_rate=48000:duration=20", "-c:a", "pcm_s16le", sound]);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const online = process.argv.slice(2).find(arg => !arg.startsWith("--"));
const cookieRetry = process.argv.includes("--cookie-retry");
assert(!cookieRetry || online, "--cookie-retry requires a public YouTube URL");
// A missing fixture profile tests extraction failure without reading real cookies.
const config = { ...defaultConfig, ...(cookieRetry ? { cookiesFromBrowser: `firefox:${path.join(directory, "missing-firefox-profile")}` } : {}) };
if (online) await ensureYtDlp(undefined, "stable", "system");
const resolver = online ? createStreamResolver(async () => config)
  : async (_track: unknown, _signal: unknown, _fresh: unknown, mode?: string) => ({
    url: mode === "video" ? picture : sound, ...(mode === "video" ? { audioUrl: sound } : {}), expiresAt: Infinity,
  });
const playback = new Playback(mpv, () => { throw Error("Unexpected external player"); }, resolver);
const track = trackFromUrl(online || "https://www.youtube.com/watch?v=abcdefghijk");
const next = { id: "smoke:local", source: "local" as const, sourceTrackId: "local", title: "Next silent fixture",
  filePath: sound, addedAt: "2026-01-01T00:00:00Z" };
const list = [track, next];
let owned: number | undefined;
try {
  await playback.changeVolume(-100);
  await playback.play(track, list, 0, true, false, "video", 2);
  if (cookieRetry) {
    assert.equal(playback.getState().cookieRetryAvailable, true, "Cookie extraction failure must offer, not perform, anonymous retry");
    await playback.retryWithoutCookies();
    assert.equal(playback.getState().withoutCookies, true);
    assert.equal(config.cookiesFromBrowser, `firefox:${path.join(directory, "missing-firefox-profile")}`, "Saved cookie selection must not change");
    if (!playback.getState().paused) await playback.togglePause();
  }
  assert.equal(playback.getState().error, undefined);
  owned = playback.mpvProcessId;
  assert(owned);
  // Read IPC only from the player owned by this fixture.
  const player = (playback as unknown as { mpv: import("../src/player/mpv").MpvPlayer }).mpv;
  const get = (name: string) => player.command(["get_property", name]);
  // file-loaded can arrive before the native GPU window has finished opening.
  for (let i = 0; i < 50 && !(await get("vo-configured")); i++) await wait(100);
  assert.equal(await get("vo-configured"), true, "Native video output must initialise");
  assert(await get("vid")); assert(await get("aid"));
  assert.equal(await get("volume"), 0);
  assert.equal(await get("pause"), true, "Initial video must remain paused");
  assert(Math.abs(Number(await get("time-pos")) - 2) < 0.5);
  for (const mode of ["audio", "video"] as const) {
    await playback.setPlaybackMode(mode);
    assert.equal(playback.getState().error, undefined);
    assert.equal(playback.mpvProcessId, owned);
    assert.equal(await get("pause"), true, `${mode} must retain pause`);
    assert.equal(await get("volume"), 0);
    assert(Math.abs(Number(await get("time-pos")) - 2) < 0.5);
    assert.deepEqual(playback.getState().list.map(t => t.id), list.map(t => t.id));
    if (mode === "audio") {
      assert.equal(await get("vid"), false);
      assert.deepEqual(await get("options/audio-files"), []);
    } else { assert(await get("vid")); assert(await get("aid")); }
  }
  await playback.togglePause();
  // Network HLS chunks can take longer than a local fixture to fill the cache.
  // Wait for decoded progress, with a hard bound, rather than a fixed 1.4s nap.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (Number(await get("time-pos")) > 2.5 && Number(await get("audio-pts")) > 2.5) break;
    await wait(200);
  }
  await playback.togglePause();
  assert(Number(await get("time-pos")) > 2.5, "Video playback clock must advance");
  assert(Number(await get("audio-pts")) > 2.5, "Decoded audio clock must advance too");
  const output = await get("audio-out-params") as { samplerate?: number } | undefined;
  assert(output && Number(output.samplerate) > 0, "Audio output must be configured, not just a selected track");
  assert.equal(await get("volume"), 0);
  console.log(`PASS: ${online ? "YouTube" : "offline separate-stream"} video/audio/video, one mpv, retained position/queue, muted playback${cookieRetry ? ", explicit cookie retry, unchanged preferences" : ""}`);
} catch (error) {
  console.error(redactLog(error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exitCode = 1;
} finally {
  owned ??= playback.mpvProcessId;
  playback.quit();
  for (let i = 0; owned && i < 40; i++) {
    try { process.kill(owned, 0); await wait(50); } catch { owned = undefined; }
  }
  assert.equal(owned, undefined, "Owned mpv must exit during cleanup");
  console.log("PASS: owned mpv cleanup; no user player touched");
}
