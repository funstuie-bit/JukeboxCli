// Optional live service acceptance: npx tsx scripts/smoke-online.ts URL [config.json]
// Muted, bounded playback, isolated session, no downloads/library changes.
// Optional config is read ONLY for resolver cookie settings; never printed.
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-online-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const { createStreamResolver } = await import("../src/player/resolve");
const { trackFromUrl } = await import("../src/player/url");
const { defaultConfig } = await import("../src/config/config");
const { findOnPath } = await import("../src/util/exec");
const { ytDlpPath } = await import("../src/bin/ytdlp-fetch");
const binary = await findOnPath("yt-dlp");
assert(binary, "Put an existing yt-dlp on PATH; this smoke test never installs tools.");
mkdirSync(path.dirname(ytDlpPath()), { recursive: true });
symlinkSync(binary, ytDlpPath());
const input = process.argv[2];
assert(input, "Usage: smoke-online.ts URL [config.json]");
const config = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : {};
const resolver = createStreamResolver(async () => ({ ...defaultConfig,
  cookiesFromBrowser: config.cookiesFromBrowser, cookiesFile: config.cookiesFile }));
const p = new Playback("mpv", () => { throw Error("Unexpected external player"); }, resolver);
try {
  await p.setVolume(0);
  const track = trackFromUrl(input);
  await p.play(track, [track], 0, true);
  assert(!p.getState().error, p.getState().error);
  assert.equal(p.getState().paused, true); assert.equal(p.getState().volume, 0);
  if (track.source === "youtube") assert.notEqual(p.getState().track?.title, track.title, "YouTube title was not resolved");
  await p.togglePause();
  const deadline = Date.now() + 8000;
  while (p.getState().position < 1 && Date.now() < deadline) await new Promise(r => setTimeout(r, 50));
  assert(p.getState().position >= 1, "Audio position did not advance");
  await p.togglePause();
  assert(!JSON.stringify(p.session()).includes("googlevideo.com"));
  console.log("PASS: live service resolution, enriched metadata, muted paused load, audio progress, pause and stable session URL");
  console.log(`Isolated fixture: ${profile}`);
} finally { p.quit(); }
