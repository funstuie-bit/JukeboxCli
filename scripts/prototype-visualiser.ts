// Isolated feasibility/acceptance harness. No real library or application config.
// npx tsx scripts/prototype-visualiser.ts [--demo] [--null-output]
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";
import { execa } from "execa";
import { BANDS, BandMeter, spectrumGraph, spectrumRows } from "./spectrum-core";

const dir = mkdtempSync(path.join(tmpdir(), "jukeboxcli-spectrum-"));
const file = path.join(dir, "stereo-tones.wav"), ipc = path.join(dir, "ipc.sock");
const demo = process.argv.includes("--demo");
const expression = "if(lt(t,2),0.05*sin(2*PI*125*t),if(lt(t,4),0.05*sin(2*PI*4000*t),0))";
// Opposite-phase stereo exercises energy measurement without mono cancellation.
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", `aevalsrc=${expression.replaceAll(",", "\\,")}|-${expression.replaceAll(",", "\\,")}:s=48000:d=6`, "-c:a", "pcm_f32le", file]);
const meters = BANDS.map(() => new BandMeter());
async function pcmHash(filtered: boolean): Promise<string> {
  const child = spawn("ffmpeg", ["-v", "error", "-i", file,
    ...(filtered ? ["-filter_complex", spectrumGraph("0:a", "out"), "-map", "[out]"] : []),
    "-c:a", "pcm_f32le", "-f", "md5", "-"], { cwd: dir, stdio: ["ignore", "pipe", "pipe", ...BANDS.map(() => "pipe" as const)] });
  let output = "", diagnostics = "";
  child.stdout!.on("data", b => { output = (output + b).slice(-1024); });
  child.stderr!.on("data", b => { diagnostics = (diagnostics + b).slice(-1024); });
  BANDS.forEach((_, i) => child.stdio[i + 3]!.on("data", () => {}));
  const timer = setTimeout(() => child.kill("SIGKILL"), 10000);
  const code = await new Promise(resolve => { child.once("exit", resolve); child.once("error", e => { diagnostics = e.message; resolve(-1); }); });
  clearTimeout(timer); assert.equal(code, 0, diagnostics); return output.trim();
}
const originalHash = await pcmHash(false), filteredHash = await pcmHash(true);
assert.equal(filteredHash, originalHash, "analysis graph must preserve float32 stereo PCM output");
let socket: net.Socket | undefined, proc: ChildProcess | undefined, error = "", buffer = "", id = 0;
let paused = true, position = 0, seeks = 0, bytes = 0;
let interrupted = false;
const interrupt = () => { interrupted = true; };
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => boolean, timeout = 6000) {
  const end = Date.now() + timeout;
  while (!fn()) { if (interrupted) throw Error("Prototype cancelled"); if (Date.now() > end) throw Error("Prototype timed out: " + error.slice(-600)); await sleep(25); }
}
function command(command: unknown[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const request_id = ++id;
    const timer = setTimeout(() => { pending.delete(request_id); reject(Error("IPC timeout")); }, 3000);
    pending.set(request_id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(Error(`${e.message} (${command[0]} ${command[1]})`)); } });
    socket!.write(JSON.stringify({ command, request_id }) + "\n");
  });
}
async function cpu(pid: number): Promise<number> {
  const { stdout } = await execa("ps", ["-p", String(pid), "-o", "time="]);
  const parts = stdout.trim().split(":").map(Number);
  return parts.reduce((total, n) => total * 60 + n, 0);
}
let renderTimer: ReturnType<typeof setInterval> | undefined;
process.once("SIGINT", interrupt); process.once("SIGTERM", interrupt);
try {
  proc = spawn("mpv", ["--no-config", "--idle=yes", "--no-video", "--no-terminal", "--pause=yes", "--volume=0",
    ...(process.argv.includes("--null-output") ? ["--ao=null"] : []),
    `--input-ipc-server=${ipc}`, `--af=lavfi=[${spectrumGraph()}]`, file],
    { cwd: dir, stdio: ["ignore", "ignore", "pipe", ...BANDS.map(() => "pipe" as const)] });
  proc.on("error", e => { error = e.message; });
  proc.stderr!.on("data", b => { error = (error + b).slice(-4096); });
  BANDS.forEach((_, i) => proc!.stdio[i + 3]!.on("data", (b: Buffer) => { bytes += b.length; meters[i]!.push(b.toString()); }));
  await until(() => !!proc?.pid);
  let connected = false;
  for (let n = 0; n < 50 && !connected; n++) {
    socket = net.createConnection(ipc);
    connected = await new Promise<boolean>(resolve => { socket!.once("connect", () => resolve(true)); socket!.once("error", () => resolve(false)); });
    if (!connected) { socket.destroy(); await sleep(100); }
  }
  assert(connected, "mpv IPC connection");
  socket!.on("data", b => {
    buffer = (buffer + b).slice(-65536);
    let end: number;
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      let msg: any; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.request_id) {
        const p = pending.get(msg.request_id); pending.delete(msg.request_id);
        if (msg.error === "success") p?.resolve(msg.data); else p?.reject(Error(msg.error));
      }
      if (msg.event === "seek") { seeks++; meters.forEach(m => m.clear()); }
      if (msg.event === "property-change" && msg.name === "time-pos" && typeof msg.data === "number") position = msg.data;
      if (msg.event === "property-change" && msg.name === "pause") paused = msg.data;
    }
  });
  await command(["observe_property", 1, "time-pos"]); await command(["observe_property", 2, "pause"]);
  let channels = 0;
  for (let n = 0; n < 60 && channels !== 2; n++) {
    try { channels = await command(["get_property", "audio-params/channel-count"]); } catch { /* file still opening */ }
    if (channels !== 2) await sleep(50);
  }
  assert.equal(channels, 2, "stereo file must finish opening");
  await command(["set_property", "pause", false]);
  const startCpu = await cpu(proc!.pid!), startTime = Date.now();
  if (demo && process.stdout.isTTY) {
    process.stdout.write("\x1b[?1049h\x1b[?25l");
    renderTimer = setInterval(() => {
      const width = Math.max(8, Math.min(100, (process.stdout.columns || 80) - 2));
      const values = meters.map(m => paused ? -120 : m.at(position)?.db ?? -120);
      const rows = spectrumRows(values, width, Math.max(1, Math.min(8, (process.stdout.rows || 24) - 5)));
      process.stdout.write("\x1b[H\x1b[J" + "JukeboxCli · LIVE BAND ENERGY · muted prototype\n" +
        `${position.toFixed(2)}s · ${paused ? "paused / blank" : "125 Hz → 4 kHz → silence"}\n` + rows.join("\n") + "\n60 Hz                         →                         8 kHz\n");
    }, 100);
  }
  await until(() => position >= 0.8 && meters.every(m => !!m.at(position)));
  const low = meters.map(m => m.at(position)!.db);
  assert.equal(low.indexOf(Math.max(...low)), 1, "125 Hz must peak in the 125 Hz band");
  await command(["set_property", "pause", true]); await until(() => paused); await sleep(350);
  const pausePosition = await command(["get_property", "time-pos"]); await sleep(300);
  assert.equal(await command(["get_property", "time-pos"]), pausePosition, "pause position must freeze after audio output settles");
  const seekBefore = seeks;
  await command(["seek", 3, "absolute+exact"]); await until(() => seeks > seekBefore);
  await command(["set_property", "pause", false]);
  await until(() => position >= 3.2 && meters.every(m => !!m.at(position)));
  const high = meters.map(m => m.at(position)!.db);
  assert.equal(high.indexOf(Math.max(...high)), 6, "4 kHz must peak in the 4 kHz band after seek");
  await until(() => position >= 5 && meters.every(m => !!m.at(position)));
  const silent = meters.map(m => m.at(position)!.db);
  assert(silent.every(db => db < -80), "silence must settle to no visible energy");
  const elapsed = (Date.now() - startTime) / 1000, cpuSeconds = await cpu(proc!.pid!) - startCpu;
  const rss = await execa("ps", ["-p", String(proc!.pid!), "-o", "rss="]);
  await command(["seek", 0.25, "absolute+exact"]);
  await until(() => position > 0.4 && position < 1.5 && meters.every(m => !!m.at(position)));
  const afterBack = meters.map(m => m.at(position)!.db);
  assert.equal(afterBack.indexOf(Math.max(...afterBack)), 1, "backwards seek must discard high-frequency/silent history");
  const report = { bands: BANDS, lowDb: low.map(Math.round), highDb: high.map(Math.round), silentDb: silent.map(Math.round),
    maxHistoryPerBand: Math.max(...meters.map(m => m.samples.length)), metadataBytes: bytes,
    cpuSeconds, wallSeconds: Number(elapsed.toFixed(2)), approximateMpvCpuPercent: Number((cpuSeconds / elapsed * 100).toFixed(1)),
    mpvRssMiB: Math.round(Number(rss.stdout.trim()) / 1024),
    seeks, stereoChannels: 2, pcmUnchanged: originalHash === filteredHash, profile: dir };
  if (renderTimer) { clearInterval(renderTimer); renderTimer = undefined; process.stdout.write("\x1b[?25h\x1b[?1049l"); }
  console.log("PASS: real mpv stereo audio tap, low/high band response, pause, seek, silence and bounded history");
  console.log(JSON.stringify(report, null, 2));
} finally {
  process.removeListener("SIGINT", interrupt); process.removeListener("SIGTERM", interrupt);
  if (renderTimer) { clearInterval(renderTimer); process.stdout.write("\x1b[?25h\x1b[?1049l"); }
  socket?.destroy();
  for (const p of pending.values()) p.reject(Error("Prototype closed")); pending.clear();
  if (proc && proc.exitCode === null && proc.signalCode === null) {
    proc.kill("SIGTERM");
    const kill = setTimeout(() => proc?.kill("SIGKILL"), 1000);
    await new Promise<void>(resolve => proc!.once("exit", () => resolve())); clearTimeout(kill);
  }
}
