// Real mpv against a loopback HTTP server, never the user's music/profile.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { execa } from "execa";
import type { StreamTrack } from "../src/player/media";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-stream-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const file = path.join(profile, "silent.wav");
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "2", file]);
const bytes = readFileSync(file);
const requests: string[] = [];
const server = createServer((req, res) => {
  requests.push(req.url!);
  assert.equal(req.headers["user-agent"], "JukeboxCli smoke");
  res.writeHead(200, { "Content-Type": "audio/wav", "Content-Length": bytes.length }); res.end(bytes);
});
await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
const address = server.address(); assert(address && typeof address !== "string");
const track = (id: string): StreamTrack => ({ kind: "stream", id: `stream:link:${id}`, title: id,
  source: "link", sourceTrackId: id, addedAt: "2026-09-07", streamUrl: `https://example.com/${id}` });
const a = track("a"), b = track("b"), c = track("c");
const local = { id: "local", title: "local", source: "local" as const, sourceTrackId: "local", filePath: file, addedAt: "2026-09-07" };
const p = new Playback("mpv", () => { throw new Error("unexpected external fallback"); }, async t => ({
  url: `http://127.0.0.1:${address.port}/${t.sourceTrackId}`, headers: { "User-Agent": "JukeboxCli smoke" }, expiresAt: Date.now() + 60_000,
}));
const waitFor = async (predicate: () => boolean, timeout = 8000) => {
  const deadline = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > deadline) throw new Error(`state timed out: ${JSON.stringify({ track: p.getState().track?.title, error: p.getState().error })}`); await new Promise(r => setTimeout(r, 25)); }
};
const played: string[] = [];
p.on("state", s => { if (s.track && !s.loading && played.at(-1) !== s.track.title) played.push(s.track.title); });
try {
  await p.setVolume(0);
  await p.play(a, [a, b, local], 0, true);
  await waitFor(() => p.getState().nextReady === true);
  await waitFor(() => requests.includes("/b")); // actual HTTP prefetch while paused
  assert.equal(p.getState().paused, true);
  await p.togglePause();
  await waitFor(() => p.getState().track === b);
  await waitFor(() => p.getState().track === local);
  await waitFor(() => p.getState().track === null);
  assert.deepEqual(played, ["a", "b", "local"]);
  await p.play(a, [a, b], 0, true);
  await waitFor(() => p.getState().nextReady === true);
  p.enqueue(c, true);
  await waitFor(() => p.getState().nextReady === true);
  await p.next(); await waitFor(() => p.getState().track === c);
  assert(requests.includes("/c"));
  await p.togglePause();
  assert.equal(p.getState().paused, true);
  assert.equal(p.session().streams?.[a.id]?.streamUrl, a.streamUrl);
  assert(!JSON.stringify(p.session()).includes("127.0.0.1"));
  console.log("PASS: real HTTP prefetch while paused, headers, stream→stream→local EOF exactly once, queue replacement, prepared skip, stable session URLs");
  console.log(`Isolated fixture profile retained: ${profile}`);
} finally { p.quit(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
