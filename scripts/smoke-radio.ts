// Real mpv, real HTTP/ICY metadata, synthetic silent MP3. No user data/network.
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type ServerResponse } from "node:http";
import assert from "node:assert/strict";
import { execa } from "execa";

const profile = mkdtempSync(path.join(tmpdir(), "jukeboxcli-radio-"));
process.env.JUKEBOXCLI_HOME = profile;
const { Playback } = await import("../src/player/playback");
const { createStreamResolver } = await import("../src/player/resolve");
const { trackFromUrl } = await import("../src/player/url");
const { discoverFeeds } = await import("../src/player/feeds");
const { saveStation, readStations } = await import("../src/player/stations");
const { persistListeningSession, readSession } = await import("../src/player/session");
const file = path.join(profile, "silence.mp3");
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", "2", "-b:a", "128k", "-write_xing", "0", file]);
const audio = readFileSync(file);
const requests: string[] = [];
const connections = new Set<ServerResponse>();
const meta = Buffer.alloc(16 * 4); meta.write("StreamTitle='Fixture artist - Silent broadcast';");
const server = createServer((req, res) => {
  requests.push(req.url!);
  if (req.url === "/station") { res.writeHead(200, { "Content-Type": "text/html" }); res.end('<title>Fixture FM</title><audio src="/live"></audio>'); return; }
  if (req.url === "/audio") { res.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Length": audio.length }); res.end(audio); return; }
  if (req.url !== "/live") { res.writeHead(404); res.end(); return; }
  connections.add(res);
  res.writeHead(200, { "Content-Type": "audio/mpeg", "icy-name": "Fixture FM", "icy-metaint": "4096" });
  let offset = 0;
  const send = () => {
    const chunk = Buffer.alloc(4096);
    for (let i = 0; i < chunk.length; i++) chunk[i] = audio[offset++ % audio.length]!;
    res.write(chunk); res.write(Buffer.from([4])); res.write(meta);
  };
  send(); const timer = setInterval(send, 100);
  res.on("close", () => { clearInterval(timer); connections.delete(res); });
});
await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
const address = server.address(); assert(address && typeof address !== "string");
const base = `http://127.0.0.1:${address.port}`;
const radio = (await discoverFeeds(`${base}/station`, true, new AbortController().signal)).tracks[0]!;
assert.equal(radio.title, "Fixture FM");
assert(!requests.includes("/live"));
const direct = trackFromUrl(`${base}/audio`);
const resolver = createStreamResolver(async () => { throw Error("Direct/radio must not read cookies/config"); });
const p = new Playback("mpv", () => { throw Error("Unexpected external app"); }, resolver);
const q = new Playback("mpv", () => { throw Error("Unexpected external app"); }, resolver);
const waitFor = async (predicate: () => boolean, timeout = 8000) => {
  const until = Date.now() + timeout;
  while (!predicate()) { if (Date.now() > until) throw Error(`Timed out: ${p.getState().error ?? "no state change"}`); await new Promise(r => setTimeout(r, 25)); }
};
try {
  await p.setVolume(0);
  // A station queued after a finite URL must not connect speculatively.
  await p.play(direct, [direct, radio], 0, true);
  assert(!p.getState().error); assert(!requests.includes("/live"));
  await p.next(); assert(!p.getState().error);
  await waitFor(() => !!p.getState().broadcastTitle);
  assert.match(p.getState().broadcastTitle!, /Silent broadcast/);
  assert.equal(p.getState().duration, 0); assert.equal(p.getState().nextReady, false);
  const loadsBeforeRename = requests.length;
  p.renameStation(radio.streamUrl, "Renamed FM");
  assert.equal(p.getState().track?.title, "Renamed FM");
  assert.equal(requests.length, loadsBeforeRename);
  assert.equal(p.getState().list.length, 2);
  await p.seek(15); await p.restart(); assert.equal(p.getState().track?.id, radio.id);
  await p.togglePause(); await waitFor(() => connections.size === 0);
  assert.equal(p.getState().paused, true);
  const before = requests.filter(r => r === "/live").length;
  await p.togglePause(); await waitFor(() => connections.size === 1);
  assert.equal(requests.filter(r => r === "/live").length, before + 1);
  saveStation(radio.title, radio.streamUrl); assert.equal(readStations()[0]?.name, "Fixture FM");
  const saver = persistListeningSession(p); saver.close();
  await q.restoreSession(readSession()!, () => undefined);
  assert.equal(q.getState().paused, true); assert.equal(q.getState().position, 0);
  assert.equal(connections.size, 1); // no second connection on restore
  for (const res of connections) res.end();
  await waitFor(() => !!p.getState().error, 15_000);
  assert.equal(p.getState().list.length, 2); assert.equal(p.getState().track?.id, radio.id);
  console.log("PASS: direct URL audio, no speculative station connection, real ICY song metadata, live pause/reconnect, favourites/session restore, disconnect retains queue");
  console.log(`Isolated fixture: ${profile}`);
} finally { p.quit(); q.quit(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
