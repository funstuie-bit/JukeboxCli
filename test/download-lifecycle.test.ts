import { afterEach, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { defaultConfig } from "../src/config/config";
import { downloadTrack } from "../src/ytdlp/ytdlp";
import { DOWNLOAD_RUNNER } from "../src/ytdlp/runner";
const fixture = vi.hoisted(() => ({ binary: "" }));
vi.mock("../src/bin/ytdlp-fetch", () => ({ resolvedYtDlpPath: () => fixture.binary }));
const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => { for (const fn of cleanup.reverse()) await fn(); cleanup.length = 0; vi.unstubAllEnvs(); });
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "jukebox-download-tree-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  fixture.binary = join(dir, "fake-ytdlp");
  const pidfile = join(dir, "pids.json");
  vi.stubEnv("JUKEBOX_TEST_PIDS", pidfile);
  await writeFile(fixture.binary, `#!${process.execPath}
const fs = require('node:fs');
const {spawn} = require('node:child_process');
if (!process.argv.includes('!is_live') || !process.argv.includes('--break-match-filters')) { console.error('Missing live filter'); process.exit(2); }
if (process.argv.at(-1) === 'fixture:live') {
  process.exit(101); // --print can suppress the explanatory stdout line
} else if (process.argv.at(-1) === 'fixture:finite') {
  console.log('SCMETA\\tfixture\\tFinite track\\tNA\\tArtist\\tNA\\t10\\tArtist\\thttps://example.com/track\\tSingles\\tm4a\\t/tmp/finite.m4a\\tNA');
} else {
  const child = spawn(process.execPath, ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},100); console.log('ready')"], {stdio:['ignore','pipe','inherit']});
  child.stdout.once('data', () => fs.writeFileSync(process.env.JUKEBOX_TEST_PIDS, JSON.stringify({root:process.pid, helper:child.pid})));
  setInterval(()=>{},100);
}
`, { mode: 0o755 });
  return { dir, pidfile };
}
async function pids(path: string) {
  let result!: { root: number; helper: number };
  await vi.waitFor(async () => { result = JSON.parse(await readFile(path, "utf8")); }, { timeout: 5000 });
  cleanup.push(() => { for (const pid of [result.root, result.helper]) try { process.kill(pid, "SIGKILL"); } catch {} });
  return result;
}
async function alive(pid: number) {
  try {
    process.kill(pid, 0);
    if (process.platform === "linux") return !(await readFile(`/proc/${pid}/stat`, "utf8")).includes(") Z ");
    return true;
  } catch { return false; }
}
it("reports a filtered live stream instead of treating it as already saved; finite media still completes", async () => {
  await setup();
  await expect(downloadTrack({ url: "fixture:live", config: defaultConfig, sourceLabel: "YouTube" })).rejects.toThrow("Live streams cannot be downloaded");
  await expect(downloadTrack({ url: "fixture:finite", config: defaultConfig, sourceLabel: "YouTube" })).resolves.toMatchObject({ status: "downloaded", meta: { id: "fixture", title: "Finite track" } });
});
it.skipIf(process.platform === "win32")("cancel kills a resistant helper in its own group, leaving unrelated playback alone", async () => {
  const { pidfile } = await setup();
  const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},100)"], { stdio: "ignore" });
  cleanup.push(() => { unrelated.kill("SIGKILL"); });
  const controller = new AbortController();
  const task = downloadTrack({ url: "fixture:hang", config: defaultConfig, sourceLabel: "YouTube", signal: controller.signal });
  const owned = await pids(pidfile);
  controller.abort();
  await expect(task).resolves.toMatchObject({ status: "canceled" });
  await vi.waitFor(async () => { expect(await alive(owned.root)).toBe(false); expect(await alive(owned.helper)).toBe(false); }, { timeout: 3000 });
  expect(await alive(unrelated.pid!)).toBe(true);
});
it.skipIf(process.platform === "win32")("cleans up the download after its host process is killed", async () => {
  const { pidfile } = await setup();
  const host = spawn(process.execPath, ["-e", `
    const {spawn}=require('node:child_process');
    spawn(process.execPath, ['-e', ${JSON.stringify(DOWNLOAD_RUNNER)}, ${JSON.stringify(fixture.binary)}, '--break-match-filters', '!is_live', 'fixture:hang'], {stdio:['ignore','ignore','ignore','pipe']});
    setInterval(()=>{},100);
  `], { stdio: "ignore" });
  cleanup.push(() => { host.kill("SIGKILL"); });
  const owned = await pids(pidfile);
  host.kill("SIGKILL");
  await vi.waitFor(async () => { expect(await alive(owned.root)).toBe(false); expect(await alive(owned.helper)).toBe(false); }, { timeout: 5000 });
});

it("does not spawn a download that was already cancelled", async () => {
  fixture.binary = "/nonexistent/should-not-spawn";
  await expect(downloadTrack({ url: "fixture:hang", config: defaultConfig, sourceLabel: "YouTube", signal: AbortSignal.abort() })).resolves.toEqual({ status: "canceled" });
});
