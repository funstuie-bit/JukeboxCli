// Same isolated fixture/filter for an approximate repeated mpv CPU comparison.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { BANDS, spectrumGraph } from "./spectrum-core";
const dir = mkdtempSync(path.join(tmpdir(), "jukeboxcli-spectrum-bench-"));
const file = path.join(dir, "noise.wav");
await execa("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "anoisesrc=d=8:c=pink:r=48000:a=0.02", "-ac", "2", file]);
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const cpu = async (pid: number) => {
  const { stdout } = await execa("ps", ["-p", String(pid), "-o", "time="]);
  return stdout.trim().split(":").map(Number).reduce((t, n) => t * 60 + n, 0);
};
const results: { filtered: boolean; cpuPercent: number; rssMiB: number }[] = [];
for (const filtered of [false, true, false, true]) {
  const child = spawn("mpv", ["--no-config", "--no-video", "--no-terminal", "--volume=0",
    ...(filtered ? [`--af=lavfi=[${spectrumGraph()}]`] : []), file],
    { cwd: dir, stdio: ["ignore", "ignore", "ignore", ...BANDS.map(() => "pipe" as const)] });
  BANDS.forEach((_, i) => child.stdio[i + 3]!.on("data", () => {}));
  let error: Error | undefined; child.on("error", e => { error = e; });
  try {
    await sleep(500); if (error) throw error;
    const start = await cpu(child.pid!), wall = Date.now(); await sleep(3000);
    const seconds = await cpu(child.pid!) - start;
    const rss = await execa("ps", ["-p", String(child.pid!), "-o", "rss="]);
    results.push({ filtered, cpuPercent: Number((seconds / ((Date.now() - wall) / 1000) * 100).toFixed(1)), rssMiB: Math.round(Number(rss.stdout.trim()) / 1024) });
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGTERM"); const timeout = setTimeout(() => child.kill("SIGKILL"), 1000);
      await new Promise<void>(resolve => child.once("exit", () => resolve())); clearTimeout(timeout);
    }
  }
}
console.log(JSON.stringify({ results, note: "Approximate short-run mpv CPU only, not a release/performance guarantee.", profile: dir }, null, 2));
