import { promises as fs, createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execa } from "execa";
import { paths } from "../config/paths";
import { findOnPath } from "../util/exec";

export const MAC_VISUALIZER_REVISION = 1;
export const MAC_VISUALIZER_ASSETS = [
  { name: "projectm", repo: "projectm", ref: "refs/tags/v4.1.7", sha256: "3733c6bf1873cb6af5e2a5d24e678f525970c63ad994355fa9d375115663b8f7" },
  { name: "eval", repo: "projectm-eval", ref: "da885dcdf33620ef26aa04cac9e215378b80252e", sha256: "c8dc837cc1bad435fe96e59e958e08c0562c064577bbb4a69b7e4aae32ff518b" },
  { name: "presets", repo: "presets-cream-of-the-crop", ref: "0180df21f5e0bd39b9060cc5de420ed2f1f9e509", sha256: "77ef8e527fb00343afdfb267f5a2e8d3d00430c563ca9f5ab2104fc306f5c674" },
  { name: "textures", repo: "presets-milkdrop-texture-pack", ref: "6368812f27bc747b517218fbf89d21d59afce4d9", sha256: "6e6ea0a0363334a79cf15e5c79115e1b99a24993c4238f14d222d9eea91c52b7" },
] as const;

export function macVisualizerSupported(platform = process.platform, release = os.release()): boolean {
  const [major = 0, minor = 0] = release.split(".").map(Number);
  // Darwin 23.4 = macOS 14.4. Linux callers never touch the Mac install.
  return platform === "darwin" && (major > 23 || (major === 23 && minor >= 4));
}

export function macVisualizerPaths(root = path.join(paths.data, "visualizer", "mac")) {
  const current = path.join(root, "current");
  const app = path.join(current, "JukeboxCli Visualizer.app");
  return { root, current, app, executable: path.join(app, "Contents", "MacOS", "jukeboxcli-visualizer"),
    presets: path.join(current, "presets"), textures: path.join(current, "textures", "textures"),
    manifest: path.join(current, "manifest.json") };
}

export async function macVisualizerInstalled(): Promise<boolean> {
  try {
    const p = macVisualizerPaths();
    const manifest = JSON.parse(await fs.readFile(p.manifest, "utf8"));
    await fs.access(p.executable, fs.constants.X_OK);
    await fs.access(p.presets);
    await fs.access(p.textures);
    return manifest.revision === MAC_VISUALIZER_REVISION && manifest.arch === process.arch;
  } catch { return false; }
}

export async function verifyVisualizerArchive(file: string, expected: string): Promise<void> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  if (hash.digest("hex") !== expected) throw Error("Visualiser download failed its SHA-256 check. Nothing was installed; try again.");
}

async function download(url: string, file: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok || !response.body) throw Error(`Visualiser download failed (HTTP ${response.status}).`);
  let bytes = 0;
  await pipeline(Readable.fromWeb(response.body as never), new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > 200 * 1024 * 1024 ? Error("Visualiser download exceeded the size limit.") : null, chunk);
    },
  }), createWriteStream(file, { flags: "wx", mode: 0o600 }));
}

async function nativeSources(): Promise<string> {
  for (const url of [new URL("./native/macos-visualizer/", import.meta.url), new URL("../../native/macos-visualizer/", import.meta.url)]) {
    const dir = fileURLToPath(url);
    try { await fs.access(path.join(dir, "main.mm")); return dir; } catch { /* bundled or source checkout */ }
  }
  throw Error("This JukeboxCli build is missing the Mac visualiser sources. Reinstall JukeboxCli first.");
}

/** Keep embedded third-party notices too, including header-only dependencies. */
async function preserveNotices(source: string, destination: string): Promise<void> {
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) await preserveNotices(from, to);
    else if (entry.isFile() && /license|copying|copyright|^readme/i.test(entry.name)) {
      await fs.mkdir(destination, { recursive: true });
      await fs.copyFile(from, to);
    }
  }
}

/** Explicit opt-in only. Normal installation and startup never call this. */
export async function installMacVisualizer(progress: (message: string) => void = () => {}): Promise<void> {
  if (!macVisualizerSupported()) throw Error("The Mac visualiser needs macOS 14.4 or newer.");
  const sources = await nativeSources();
  try { await execa("/usr/bin/xcrun", ["--find", "clang++"]); }
  catch { throw Error("Install Apple's Command Line Tools with xcode-select --install, then retry."); }
  const p = macVisualizerPaths();
  await fs.mkdir(p.root, { recursive: true });
  const lock = path.join(p.root, "install.lock");
  try { await fs.mkdir(lock); }
  catch { throw Error("A visualiser install is already running. If it was interrupted, remove the install.lock folder in the visualiser data directory and retry."); }
  let stage: string | undefined;
  try {
    let cmake = await findOnPath("cmake");
    if (!cmake) {
      const brew = await findOnPath("brew");
      if (!brew) throw Error("Install CMake (brew install cmake), then retry the optional visualiser install.");
      progress("Installing CMake with Homebrew (optional visualiser build tool)…");
      await execa(brew, ["install", "cmake"], { timeout: 600_000, env: { HOMEBREW_NO_AUTO_UPDATE: "1" } });
      cmake = await findOnPath("cmake");
      if (!cmake) throw Error("CMake is not on PATH. Open a new terminal and retry.");
    }
    stage = await fs.mkdtemp(path.join(p.root, ".install-"));
    const payload = path.join(stage, "payload");
    await fs.mkdir(payload);
    for (const asset of MAC_VISUALIZER_ASSETS) {
      progress(`Downloading and verifying ${asset.repo}…`);
      const archive = path.join(stage, `${asset.name}.tar.gz`);
      await download(`https://codeload.github.com/projectM-visualizer/${asset.repo}/tar.gz/${asset.ref}`, archive);
      await verifyVisualizerArchive(archive, asset.sha256);
      const dest = path.join(asset.name === "presets" || asset.name === "textures" ? payload : stage, asset.name);
      await fs.mkdir(dest);
      await execa("/usr/bin/tar", ["-xzf", archive, "--strip-components=1", "-C", dest], { timeout: 120_000 });
    }
    await fs.cp(path.join(stage, "eval"), path.join(stage, "projectm", "vendor", "projectm-eval"), { recursive: true });
    const build = path.join(stage, "build");
    const prefix = path.join(stage, "libprojectm");
    progress("Building projectM 4.1.7 for this Mac. This can take a few minutes…");
    await execa(cmake, ["-S", path.join(stage, "projectm"), "-B", build,
      "-DCMAKE_BUILD_TYPE=Release", `-DCMAKE_INSTALL_PREFIX=${prefix}`, "-DCMAKE_OSX_DEPLOYMENT_TARGET=14.4",
      "-DENABLE_PLAYLIST=OFF", "-DBUILD_TESTING=OFF", "-DENABLE_SYSTEM_PROJECTM_EVAL=OFF", "-DBUILD_SHARED_LIBS=ON"], { timeout: 120_000 });
    await execa(cmake, ["--build", build, "--parallel", String(Math.min(os.availableParallelism(), 4))], { timeout: 900_000 });
    await execa(cmake, ["--install", build], { timeout: 120_000 });
    progress("Building the Mac audio-capture companion…");
    const contents = path.join(payload, "JukeboxCli Visualizer.app", "Contents");
    const frameworks = path.join(contents, "Frameworks");
    await fs.mkdir(frameworks, { recursive: true });
    await fs.mkdir(path.join(contents, "MacOS"));
    await fs.copyFile(path.join(sources, "Info.plist"), path.join(contents, "Info.plist"));
    const dylib = path.join(frameworks, "libprojectM-4.4.dylib");
    await fs.copyFile(path.join(prefix, "lib", "libprojectM-4.4.dylib"), dylib);
    await execa("/usr/bin/install_name_tool", ["-id", "@rpath/libprojectM-4.4.dylib", dylib]);
    const executable = path.join(contents, "MacOS", "jukeboxcli-visualizer");
    await execa("/usr/bin/xcrun", ["clang++", "-std=c++17", "-O2", "-fobjc-arc", "-Wno-deprecated-declarations",
      "-mmacosx-version-min=14.4", path.join(sources, "main.mm"), "-I", path.join(prefix, "include"),
      dylib, "-framework", "Cocoa", "-framework", "CoreAudio", "-framework", "OpenGL",
      "-Wl,-rpath,@executable_path/../Frameworks", "-o", executable], { timeout: 120_000 });
    // Preserve LGPL and preset notices, with exact upstream source provenance.
    await fs.mkdir(path.join(payload, "licenses"));
    for (const name of await fs.readdir(path.join(stage, "projectm"))) {
      if (/^(LICENSE|COPYING)/i.test(name)) await fs.copyFile(path.join(stage, "projectm", name), path.join(payload, "licenses", name));
    }
    await preserveNotices(path.join(stage, "projectm", "vendor"), path.join(payload, "licenses", "vendor"));
    await fs.writeFile(path.join(payload, "manifest.json"), JSON.stringify({ revision: MAC_VISUALIZER_REVISION,
      arch: process.arch, assets: MAC_VISUALIZER_ASSETS }, null, 2) + "\n");
    await execa("/usr/bin/codesign", ["--force", "--sign", "-", dylib]);
    await execa("/usr/bin/codesign", ["--force", "--sign", "-", path.dirname(contents)]);
    await execa(executable, ["--check"], { timeout: 15_000 });
    const previous = path.join(stage, "previous");
    let backedUp = false;
    try { await fs.rename(p.current, previous); backedUp = true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    try { await fs.rename(payload, p.current); }
    catch (error) { if (backedUp) await fs.rename(previous, p.current); throw error; }
    progress("Installed: projectM + Cream of the Crop + MilkDrop textures. Play music, then press F in Now Playing. macOS may ask for audio-recording permission.");
  } finally {
    try { if (stage) await fs.rm(stage, { recursive: true, force: true }); }
    finally { await fs.rmdir(lock); }
  }
}
