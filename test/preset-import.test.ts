import { expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { execa } from "execa";
import { previewPresetImport, commitPresetImport, discardPresetImport, listImportedPacks } from "../src/player/import-preset-pack";
const temp = () => fs.mkdtemp(path.join(os.tmpdir(), "preset-import-test-"));
it("previews folders without selecting, preserves collisions and notices, then commits atomically", async () => {
  const source = await temp(), base = await temp();
  await fs.mkdir(path.join(source, "nested"));
  await fs.writeFile(path.join(source, "same.milk"), "preset1");
  await fs.writeFile(path.join(source, "nested/same.milk"), "preset2");
  await fs.writeFile(path.join(source, "texture.png"), "texture");
  await fs.writeFile(path.join(source, "LICENSE.txt"), "notice");
  await fs.writeFile(path.join(source, "ignored.sh"), "ignored");
  const preview = await previewPresetImport(source, base);
  expect(preview).toMatchObject({ presets: 2, textures: 1 });
  expect(await listImportedPacks(base)).toEqual([]);
  await commitPresetImport(preview);
  expect(await listImportedPacks(base)).toHaveLength(1);
  expect(await fs.readdir(path.join(base, preview.id.slice(7), "presets"))).toHaveLength(3);
  expect(await fs.readFile(path.join(source, "same.milk"), "utf8")).toBe("preset1");
});
it("rejects links, conflicting textures and oversized files; discards previews", async () => {
  const source = await temp(), base = await temp();
  await fs.writeFile(path.join(source, "ok.milk"), "preset");
  const preview = await previewPresetImport(source, base); await discardPresetImport(preview);
  expect(await fs.readdir(base)).toEqual([]);
  await fs.symlink("/etc/passwd", path.join(source, "bad.milk"));
  await expect(previewPresetImport(source, base)).rejects.toThrow("link");
  await fs.unlink(path.join(source, "bad.milk"));
  const handle = await fs.open(path.join(source, "big.milk"), "w"); await handle.truncate(17 * 1048576); await handle.close();
  await expect(previewPresetImport(source, base)).rejects.toThrow("limits");
  expect(await fs.readdir(base)).toEqual([]);
});
// Python is fixture generation only; the shipping importer is entirely Node.
it.runIf(process.platform === "linux")("imports ZIP content and rejects traversal and ZIP symlinks", async () => {
  const dir = await temp(), base = await temp();
  await execa("python3", ["-c", `import zipfile,sys
p=sys.argv[1]
with zipfile.ZipFile(p+'/ok.zip','w') as z:z.writestr('folder/a.milk','preset');z.writestr('folder/LICENSE.txt','notice')
with zipfile.ZipFile(p+'/escape.zip','w') as z:z.writestr('../outside.milk','no')
with zipfile.ZipFile(p+'/link.zip','w') as z:
 i=zipfile.ZipInfo('link.milk');i.create_system=3;i.external_attr=0o120777<<16;z.writestr(i,'/etc/passwd')`, dir]);
  const preview = await previewPresetImport(path.join(dir, "ok.zip"), base);
  expect(preview.presets).toBe(1); await discardPresetImport(preview);
  await expect(previewPresetImport(path.join(dir, "escape.zip"), base)).rejects.toThrow();
  await expect(previewPresetImport(path.join(dir, "link.zip"), base)).rejects.toThrow("link");
  expect(await fs.readdir(base)).toEqual([]);
});

it("rejects ambiguous texture basenames without publishing a partial pack", async () => {
  const source = await temp(), base = await temp();
  await fs.mkdir(path.join(source, "nested"));
  await fs.writeFile(path.join(source, "ok.milk"), "preset");
  await fs.writeFile(path.join(source, "Texture.png"), "one");
  await fs.writeFile(path.join(source, "nested/texture.PNG"), "two");
  await expect(previewPresetImport(source, base)).rejects.toThrow("Conflicting");
  expect(await fs.readdir(base)).toEqual([]);
});
