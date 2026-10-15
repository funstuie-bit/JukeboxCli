import { promises as fs, constants, createWriteStream } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl from "yauzl";
import { paths } from "../config/paths";

export const importedRoot = path.join(paths.data, "projectM", "imports");
const MAX_FILES = 25000, MAX_BYTES = 256 * 1024 * 1024, MAX_FILE = 16 * 1024 * 1024;
const accepted = /\.(milk|png|jpe?g|dds|tga|bmp|dib)$/i;
const notice = /^(license|copying|readme|notice)([._ -].*)?$/i;
export interface ImportedPack { id: `import:${string}`; name: string; presets: number; textures: number; bytes: number }
export interface PackPreview extends ImportedPack { stage: string; names: string[] }
export const isImportedPack = (value: unknown): value is ImportedPack["id"] => typeof value === "string" && /^import:[a-f0-9-]{36}$/.test(value);
export async function listImportedPacks(base = importedRoot): Promise<ImportedPack[]> {
  const names = await fs.readdir(base).catch(() => []);
  const packs: ImportedPack[] = [];
  for (const name of names) {
    if (!isImportedPack(`import:${name}`)) continue;
    try {
      const item = JSON.parse(await fs.readFile(path.join(base, name, "manifest.json"), "utf8"));
      if (item.id === `import:${name}` && typeof item.name === "string" && item.presets > 0) packs.push(item);
    } catch { /* incomplete pack */ }
  }
  return packs;
}

/** Copies into private staging before preview. No extraction follows user paths. */
export async function previewPresetImport(source: string, base = importedRoot): Promise<PackPreview> {
  await fs.mkdir(base, { recursive: true });
  const stage = await fs.mkdtemp(path.join(base, ".preview-"));
  const result: PackPreview = { id: `import:${randomUUID()}`, name: path.basename(source).replace(/\.zip$/i, "").replace(/[\x00-\x1f\x7f-\x9f]/g, "").slice(0, 80), presets: 0, textures: 0, bytes: 0, stage, names: [] };
  const seen = new Set<string>();
  let entries = 0;
  await fs.mkdir(path.join(stage, "presets")); await fs.mkdir(path.join(stage, "notices"));
  const destination = (name: string, size: number): string | null => {
    if (++entries > MAX_FILES || size > MAX_FILE || size < 0) throw Error("Pack exceeds import limits (25,000 files; 16 MiB each).");
    result.bytes += size;
    if (result.bytes > MAX_BYTES) throw Error("Pack exceeds the 256 MiB expanded size limit.");
    if (name.endsWith("/")) {
      if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..") || /^[a-z]:/i.test(name)) throw Error("Unsafe archive directory.");
      return null;
    }
    if (name.includes("\\") || name.startsWith("/") || /^[a-z]:/i.test(name) || name.split("/").some(p => p === "..") || /[\x00-\x1f\x7f-\x9f]/.test(name)) throw Error("Unsafe archive filename.");
    const leaf = path.basename(name), milk = /\.milk$/i.test(leaf);
    if (!accepted.test(leaf) && !notice.test(leaf)) return null;
    const output = milk || notice.test(leaf) ? `${entries}-${leaf}` : leaf;
    const folder = accepted.test(leaf) ? "presets" : "notices";
    const key = `${folder}/${output}`.toLowerCase();
    if (seen.has(key)) throw Error(`Conflicting texture or notice filename: ${leaf}`);
    seen.add(key);
    if (milk) { result.presets++; if (result.names.length < 5) result.names.push(leaf); }
    else if (accepted.test(leaf)) result.textures++;
    return path.join(stage, folder, output);
  };
  try {
    const stat = await fs.lstat(source);
    if (stat.isSymbolicLink()) throw Error("Choose a real folder or ZIP, not a symbolic link.");
    if (stat.isDirectory()) {
      const visit = async (dir: string, depth = 0) => {
        if (depth > 32) throw Error("Pack folders are nested too deeply.");
        for await (const entry of await fs.opendir(dir)) {
          const file = path.join(dir, entry.name), st = await fs.lstat(file);
          if (st.isSymbolicLink() || (!st.isFile() && !st.isDirectory())) throw Error("Pack contains a link or special file.");
          if (st.isDirectory()) { if (++entries > MAX_FILES) throw Error("Too many pack entries."); await visit(file, depth + 1); }
          else {
            const target = destination(path.relative(source, file).split(path.sep).join("/"), st.size);
            if (target) {
              const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
              try {
                const actual = await handle.stat();
                if (!actual.isFile() || actual.size !== st.size) throw Error("Pack changed during preview. Try again.");
                let bytes = 0;
                await pipeline(handle.createReadStream({ autoClose: false }), new Transform({ transform(chunk, _, cb) { bytes += chunk.length; cb(bytes > st.size ? Error("Pack file grew during preview.") : null, chunk); } }), createWriteStream(target, { flags: "wx" }));
              } finally { await handle.close(); }
            }
          }
        }
      };
      await visit(source);
    } else if (stat.isFile() && /\.zip$/i.test(source)) {
      if (stat.size > MAX_BYTES) throw Error("ZIP exceeds 256 MiB.");
      await new Promise<void>((resolve, reject) => {
        yauzl.open(source, { lazyEntries: true, strictFileNames: true, validateEntrySizes: true }, (error, zip) => {
          if (error || !zip) { reject(error); return; }
          const fail = (error: unknown) => { zip.close(); reject(error); };
          zip.on("error", fail); zip.on("end", resolve);
          zip.on("entry", (entry: yauzl.Entry) => {
            void (async () => {
              const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
              if (mode && mode !== 0x8000 && mode !== 0x4000) throw Error("ZIP contains a link or special file.");
              if (entry.isEncrypted()) throw Error("Encrypted ZIPs are unsupported.");
              if (entry.fileName.endsWith("/")) { destination(entry.fileName, 0); zip.readEntry(); return; }
              const target = destination(entry.fileName, entry.uncompressedSize);
              if (target) {
                const stream = await new Promise<NodeJS.ReadableStream>((res, rej) => zip.openReadStream(entry, (e, s) => e || !s ? rej(e) : res(s)));
                let bytes = 0;
                await pipeline(stream, new Transform({ transform(chunk, _, cb) { bytes += chunk.length; cb(bytes > entry.uncompressedSize || bytes > MAX_FILE ? Error("ZIP expanded beyond declared size.") : null, chunk); } }), createWriteStream(target, { flags: "wx" }));
              }
              zip.readEntry();
            })().catch(fail);
          });
          zip.readEntry();
        });
      });
    } else throw Error("Choose a preset folder or a .zip archive.");
    if (!result.presets) throw Error("No .milk presets found.");
    return result;
  } catch (error) { await fs.rm(stage, { recursive: true, force: true }); throw error; }
}
export async function discardPresetImport(preview: PackPreview) { await fs.rm(preview.stage, { recursive: true, force: true }); }
export async function commitPresetImport(preview: PackPreview): Promise<ImportedPack> {
  const { stage, names, ...manifest } = preview;
  await fs.writeFile(path.join(stage, "manifest.json"), JSON.stringify(manifest, null, 2));
  await fs.rename(stage, path.join(path.dirname(stage), preview.id.slice(7)));
  return manifest;
}
