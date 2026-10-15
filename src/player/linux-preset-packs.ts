import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execa } from "execa";
import { isImportedPack, listImportedPacks } from "./import-preset-pack";
import { paths } from "../config/paths";

export const PRESET_PACKS = ["classic", "cream-of-the-crop", "combined", "milkdrop-original", "en-d"] as const;
export type PresetPack = typeof PRESET_PACKS[number] | `import:${string}`;
export const isPresetPack = (value: unknown): value is PresetPack => PRESET_PACKS.includes(value as typeof PRESET_PACKS[number]) || isImportedPack(value);
export const presetPackLabel = (pack: PresetPack): string => isImportedPack(pack) ? "Imported pack" : ({ classic: "Built-in Classic", "cream-of-the-crop": "Cream of the Crop", combined: "Combined / shuffled", "milkdrop-original": "MilkDrop Original", "en-d": "En D" })[pack as typeof PRESET_PACKS[number]];
const root = path.join(paths.data, "projectM");
export const PACK_SOURCES = [
  { repo: "presets-cream-of-the-crop", revision: "0180df21f5e0bd39b9060cc5de420ed2f1f9e509", sha256: "77ef8e527fb00343afdfb267f5a2e8d3d00430c563ca9f5ab2104fc306f5c674" },
  { repo: "presets-milkdrop-texture-pack", revision: "6368812f27bc747b517218fbf89d21d59afce4d9", sha256: "6e6ea0a0363334a79cf15e5c79115e1b99a24993c4238f14d222d9eea91c52b7" },
] as const;
export const EXTRA_PACK_SOURCES = {
  "milkdrop-original": { repo: "presets-milkdrop-original", revision: "e03b83e3338d8f1ed6cbcf908c719f249ef24288", sha256: "7d77502c03a10bb989e69b4bb01a8e65a1710f8cc23e3b5eff73f2b54d882630" },
  "en-d": { repo: "presets-en-d", revision: "fff71ea81223109f3558351667eef851f2781c96", sha256: "fa91e0fa4acd1d9fb6c42c50f12360ceee761826e2282c86bca6df19b2a22e0b" },
} as const;
export type DownloadablePack = "cream-of-the-crop" | keyof typeof EXTRA_PACK_SOURCES;
export const DOWNLOADABLE_PACKS: DownloadablePack[] = ["cream-of-the-crop", "milkdrop-original", "en-d"];
const packSources = (pack: DownloadablePack) => [pack === "cream-of-the-crop" ? PACK_SOURCES[0] : EXTRA_PACK_SOURCES[pack], PACK_SOURCES[1]];
const packRevision = (pack: DownloadablePack) => packSources(pack).map(s => s.revision.slice(0, 12)).join("-");
const packDir = (base: string, pack: DownloadablePack) => path.join(base, `${pack === "cream-of-the-crop" ? "cream" : pack}-${packRevision(pack)}`);
export async function downloadedPackInstalled(pack: DownloadablePack, base = root): Promise<boolean> {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(packDir(base, pack), "manifest.json"), "utf8"));
    const files = await fs.readdir(path.join(packDir(base, pack), "presets"));
    return (pack === "cream-of-the-crop" || manifest.format === 2) && manifest.revision === packRevision(pack) && manifest.presets > 0 && manifest.textures > 0 && files.filter(f => /\.milk$/i.test(f)).length === manifest.presets && files.filter(f => texturePattern.test(f)).length === manifest.textures;
  } catch { return false; }
}
const revision = PACK_SOURCES.map(s => s.revision.slice(0, 12)).join("-");
const installedDir = (base: string) => path.join(base, `cream-${revision}`);
const texturePattern = /\.(png|jpe?g|dds|tga|bmp|dib)$/i;

export async function creamInstalled(base = root): Promise<boolean> {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(installedDir(base), "manifest.json"), "utf8"));
    const files = await fs.readdir(path.join(installedDir(base), "presets"));
    return manifest.revision === revision && manifest.presets > 0 && manifest.textures > 0 &&
      files.filter(f => /\.milk$/i.test(f)).length === manifest.presets &&
      files.filter(f => texturePattern.test(f)).length === manifest.textures;
  } catch { return false; }
}

/** Only known, pinned archives reach extraction; no arbitrary archive imports. */
export async function downloadVerified(url: string, destination: string, sha256: string, fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok || !response.body) throw Error(`Pack download failed (HTTP ${response.status}).`);
  const file = await fs.open(destination, "wx");
  const hash = createHash("sha256");
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 64 * 1024 * 1024) throw Error("Pack download exceeds the 64 MB limit.");
      hash.update(chunk);
      await file.writeFile(chunk);
    }
    if (hash.digest("hex") !== sha256) throw Error("Pack checksum mismatch; nothing installed. Try again later.");
  } catch (error) {
    await file.close();
    await fs.rm(destination, { force: true });
    throw error;
  }
  await file.close();
}

async function filesUnder(directory: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(dir: string) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) throw Error("Preset source contains an unsupported symbolic link.");
      if (entry.isDirectory()) await visit(file);
      else if (entry.isFile()) files.push(file);
      if (files.length > 25000) throw Error("Preset pack is too large.");
    }
  }
  await visit(directory);
  return files.sort();
}

/** Flat, collision-safe preset names; texture basenames must remain unchanged. */
export async function flattenPack(presetSource: string, textureSource: string, destination: string) {
  await fs.mkdir(destination, { recursive: true });
  let presets = 0, textures = 0;
  for (const file of await filesUnder(presetSource)) {
    if (!/\.milk$/i.test(file)) continue;
    const id = createHash("sha256").update(path.relative(presetSource, file)).digest("hex").slice(0, 16);
    const name = path.basename(file, path.extname(file)).replace(/[^a-zA-Z0-9 ._()-]/g, "_").slice(0, 150);
    await fs.copyFile(file, path.join(destination, `${id}-${name}.milk`));
    presets++;
  }
  const names = new Set<string>();
  for (const file of await filesUnder(textureSource)) {
    if (!texturePattern.test(file)) continue;
    const name = path.basename(file);
    if (names.has(name.toLowerCase())) throw Error(`Duplicate texture name: ${name}`);
    names.add(name.toLowerCase());
    await fs.copyFile(file, path.join(destination, name));
    textures++;
  }
  // Pack-specific textures override the shared texture pack; preserve basenames.
  const ownNames = new Set<string>();
  for (const file of await filesUnder(presetSource)) {
    if (!texturePattern.test(file)) continue;
    const name = path.basename(file), key = name.toLowerCase();
    if (ownNames.has(key)) throw Error(`Duplicate pack texture name: ${name}`);
    ownNames.add(key);
    const previous = (await fs.readdir(destination)).find(n => texturePattern.test(n) && n.toLowerCase() === key);
    if (previous && previous !== name) await fs.rm(path.join(destination, previous));
    await fs.copyFile(file, path.join(destination, name));
    if (!names.has(key)) { names.add(key); textures++; }
  }
  if (!presets || !textures) throw Error("Pack is missing presets or required textures.");
  return { presets, textures };
}

let installing: Promise<void> | undefined;
export function installCreamPack(progress: (message: string) => void = () => {}): Promise<void> { return installPresetPack("cream-of-the-crop", progress); }
export function installPresetPack(pack: DownloadablePack, progress: (message: string) => void = () => {}): Promise<void> {
  if (process.platform !== "linux") return Promise.reject(Error("This preset installer currently supports Linux only."));
  if (installing) return Promise.reject(Error("Another preset download is already running."));
  return installing = install(progress, pack).finally(() => { installing = undefined; });
}

async function install(progress: (message: string) => void, pack: DownloadablePack): Promise<void> {
  const sources = packSources(pack);
  const revision = packRevision(pack);
  if (await downloadedPackInstalled(pack)) { progress(`${presetPackLabel(pack)} is already installed.`); return; }
  await fs.mkdir(root, { recursive: true });
  const stage = await fs.mkdtemp(path.join(root, ".install-"));
  try {
    for (const source of sources) {
      progress(`Downloading ${source.repo === sources[0]!.repo ? presetPackLabel(pack) : "MilkDrop textures"}…`);
      const archive = path.join(stage, `${source.repo}.tar.gz`);
      await downloadVerified(`https://codeload.github.com/projectM-visualizer/${source.repo}/tar.gz/${source.revision}`, archive, source.sha256);
      const dir = path.join(stage, source.repo);
      await fs.mkdir(dir);
      await execa("tar", ["-xzf", archive, "--strip-components=1", "--no-same-owner", "-C", dir], { timeout: 60_000 });
    }
    progress("Preparing presets and textures…");
    const ready = path.join(stage, "ready");
    const counts = await flattenPack(path.join(stage, sources[0]!.repo), path.join(stage, sources[1]!.repo), path.join(ready, "presets"));
    await fs.mkdir(path.join(ready, "provenance"));
    for (const source of sources) {
      for (const from of await filesUnder(path.join(stage, source.repo))) {
        if (!/^(license|copying|readme|notice)([._ -].*)?$/i.test(path.basename(from))) continue;
        const key = createHash("sha256").update(path.relative(stage, from)).digest("hex").slice(0, 12);
        await fs.copyFile(from, path.join(ready, "provenance", `${source.repo}-${key}-${path.basename(from)}`));
      }
    }
    await fs.writeFile(path.join(ready, "manifest.json"), JSON.stringify({ format: 2, revision, ...counts, sources }, null, 2));
    // No changes to the selected pack or a healthy installation before success.
    const target = packDir(root, pack);
    if (await downloadedPackInstalled(pack)) return; // Another process finished first.
    const backup = `${target}.old-${process.pid}`;
    const exists = await fs.stat(target).catch(() => null);
    if (exists) await fs.rename(target, backup);
    try { await fs.rename(ready, target); }
    catch (error) { if (exists) await fs.rename(backup, target); throw error; }
    await fs.rm(backup, { recursive: true, force: true });
    progress(`Installed ${counts.presets.toLocaleString()} presets and ${counts.textures} textures.`);
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}

export async function preparePresetPack(pack: PresetPack, base = root, classicRoots = ["/usr/share/projectM/presets", "/usr/local/share/projectM/presets"]): Promise<{ directory: string; warning?: string }> {
  if (isImportedPack(pack)) {
    const found = (await listImportedPacks(path.join(base, "imports"))).find(p => p.id === pack);
    if (!found) throw Error("Imported pack is missing. Choose another pack in Settings.");
    return { directory: path.join(base, "imports", pack.slice(7), "presets") };
  }
  if (pack === "milkdrop-original" || pack === "en-d") {
    if (!await downloadedPackInstalled(pack, base)) throw Error("Selected pack is not installed. Download it in MilkDrop packs.");
    return { directory: path.join(packDir(base, pack), "presets") };
  }
  const classic = (await Promise.all(classicRoots.map(async p => await fs.stat(p).catch(() => null) ? p : undefined))).find(Boolean);
  const installed = pack !== "classic" && await creamInstalled(base);
  if (!installed) {
    if (!classic) throw Error("Built-in presets are missing. Install projectm-pulseaudio or download Cream of the Crop in Settings.");
    return { directory: classic, ...(pack !== "classic" ? { warning: "Selected pack is missing; using Built-in Classic. Download it in Settings → Player appearance → MilkDrop packs." } : {}) };
  }
  const cream = path.join(installedDir(base), "presets");
  if (pack !== "combined" || !classic) return { directory: cream, ...(!classic && pack === "combined" ? { warning: "Built-in Classic is unavailable; using Cream of the Crop." } : {}) };
  const destination = path.join(base, `combined-${revision}`);
  if (await fs.stat(path.join(destination, ".complete")).catch(() => null)) return { directory: destination };
  const stage = await fs.mkdtemp(path.join(base, ".combined-"));
  try {
    for (const file of await filesUnder(classic)) {
      if (!/\.milk$/i.test(file) && !texturePattern.test(file)) continue;
      const name = /\.milk$/i.test(file) ? `classic-${createHash("sha256").update(file).digest("hex").slice(0, 16)}.milk` : path.basename(file);
      await fs.symlink(file, path.join(stage, name)).catch(error => { if (error.code !== "EEXIST") throw error; });
    }
    for (const name of await fs.readdir(cream)) {
      // The optional pack's official textures take precedence over classic copies.
      await fs.rm(path.join(stage, name), { force: true });
      await fs.symlink(path.join(cream, name), path.join(stage, name));
    }
    await fs.writeFile(path.join(stage, ".complete"), revision);
    await fs.rename(stage, destination).catch(async error => {
      if (!(await fs.stat(path.join(destination, ".complete")).catch(() => null))) throw error;
    });
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
  return { directory: destination };
}
