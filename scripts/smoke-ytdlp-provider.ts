// Explicit network smoke: downloads official nightly into an isolated profile.
// No music/cookies, no system tool modification. Requires existing system tools.
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

if (!process.argv.includes("--download-nightly")) throw Error("Opt in with --download-nightly (downloads and runs yt-dlp --version).");
const profile = await mkdtemp(path.join(os.tmpdir(), "jukeboxcli-ytdlp-smoke-"));
process.env.JUKEBOXCLI_HOME = profile;
process.env.JUKEBOXCLI_SYSTEM_TOOLS = "1";
const { detectSystemYtDlp, ytDlpPath, stagedYtDlpPath, resolvedYtDlpPath } = await import("../src/bin/ytdlp-fetch");
const { updateYtDlpNow } = await import("../src/bin/ytdlp-update");
const { ensureBinaries } = await import("../src/bin/binaries");
const { defaultConfig, saveConfig } = await import("../src/config/config");
const { installationReport } = await import("../src/cli/doctor");
const system = await detectSystemYtDlp();
assert(system, "system yt-dlp is required for this comparison");
const hash = async () => createHash("sha256").update(await readFile(system)).digest("hex");
const before = await hash();
const version = await updateYtDlpNow("nightly");
assert((await readFile(stagedYtDlpPath())).length > 0);
await saveConfig({ ...defaultConfig, ytdlpProvider: "managed", ytdlpChannel: "nightly" });
const binaries = await ensureBinaries(undefined, "nightly", "managed");
assert.equal(binaries.ytDlp, ytDlpPath());
assert.equal(resolvedYtDlpPath(), ytDlpPath());
assert(!binaries.ffmpeg.startsWith(profile));
assert(!binaries.ffprobe.startsWith(profile));
assert(binaries.mpv && !binaries.mpv.startsWith(profile));
assert.equal(await hash(), before, "system yt-dlp must be untouched");
const doctor = await installationReport();
assert.equal(doctor.ytDlpProvider, "managed");
assert(doctor.managedYtDlp?.version);
console.log(JSON.stringify({ result: "PASS", release: version, installed: doctor.managedYtDlp.version,
  profile, ytDlp: binaries.ytDlp, mpv: binaries.mpv, ffmpeg: binaries.ffmpeg, ffprobe: binaries.ffprobe,
  systemBinaryUnchanged: true }, null, 2));
