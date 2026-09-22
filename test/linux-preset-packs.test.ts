import { describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { creamInstalled, downloadVerified, flattenPack, PACK_SOURCES, preparePresetPack, installCreamPack } from "../src/player/linux-preset-packs";
import { paths } from "../src/config/paths";

const temp = () => fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-packs-"));
const revision = PACK_SOURCES.map(s => s.revision.slice(0, 12)).join("-");
async function installed(base: string) {
  const dir = path.join(base, `cream-${revision}`);
  await fs.mkdir(path.join(dir, "presets"), { recursive: true });
  await fs.writeFile(path.join(dir, "presets", "test.milk"), "fixture");
  await fs.writeFile(path.join(dir, "presets", "texture.jpg"), "fixture");
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ revision, presets: 1, textures: 1 }));
  return dir;
}

describe("optional Linux preset packs", () => {
  it("verifies download bytes and removes a corrupt archive", async () => {
    const file = path.join(await temp(), "pack.tar.gz");
    const fetcher = vi.fn().mockImplementation(async () => new Response("fixture"));
    await expect(downloadVerified("https://example.invalid", file, "wrong", fetcher)).rejects.toThrow("checksum");
    await expect(fs.stat(file)).rejects.toThrow();
    await downloadVerified("https://example.invalid", file, createHash("sha256").update("fixture").digest("hex"), fetcher);
    expect(await fs.readFile(file, "utf8")).toBe("fixture");
  });
  it("rejects HTTP failure without creating an archive", async () => {
    const file = path.join(await temp(), "missing");
    await expect(downloadVerified("https://example.invalid", file, "", async () => new Response("", { status: 503 }))).rejects.toThrow("503");
    await expect(fs.stat(file)).rejects.toThrow();
  });
  it("retains both same-named nested presets and required texture names", async () => {
    const dir = await temp();
    for (const name of ["a", "b", "textures"]) await fs.mkdir(path.join(dir, name));
    await fs.writeFile(path.join(dir, "a", "same.milk"), "first");
    await fs.writeFile(path.join(dir, "b", "same.milk"), "second");
    await fs.writeFile(path.join(dir, "textures", "Exact_Name.png"), "image");
    const out = path.join(await temp(), "flat");
    expect(await flattenPack(dir, path.join(dir, "textures"), out)).toEqual({ presets: 2, textures: 1 });
    const names = await fs.readdir(out);
    expect(names.filter(n => n.endsWith(".milk"))).toHaveLength(2);
    expect(names).toContain("Exact_Name.png");
  });
  it("rejects linked source files and missing textures", async () => {
    const dir = await temp(), out = await temp(), textures = await temp();
    await fs.writeFile(path.join(dir, "ok.milk"), "fixture");
    await expect(flattenPack(dir, textures, out)).rejects.toThrow("textures");
    await fs.symlink("/etc/passwd", path.join(dir, "linked.milk"));
    await expect(flattenPack(dir, textures, out)).rejects.toThrow("symbolic link");
  });
  it("does not download on launch and falls back visibly when an optional pack is absent", async () => {
    const base = await temp(), classic = await temp();
    const fetcher = vi.spyOn(globalThis, "fetch");
    try {
      expect(await preparePresetPack("classic", base, [classic])).toEqual({ directory: classic });
      expect(await preparePresetPack("cream-of-the-crop", base, [classic])).toMatchObject({ directory: classic, warning: expect.stringContaining("missing") });
      expect(fetcher).not.toHaveBeenCalled();
    } finally { fetcher.mockRestore(); }
  });
  it("detects a damaged install, including missing textures", async () => {
    const base = await temp(), dir = await installed(base);
    expect(await creamInstalled(base)).toBe(true);
    await fs.unlink(path.join(dir, "presets", "texture.jpg"));
    expect(await creamInstalled(base)).toBe(false);
  });
  it("combines classic and extra presets without losing textures or writing to system directories", async () => {
    const base = await temp(), classic = await temp();
    await installed(base);
    await fs.writeFile(path.join(classic, "test.milk"), "classic");
    const result = await preparePresetPack("combined", base, [classic]);
    expect((await fs.readdir(result.directory)).filter(f => f.endsWith(".milk"))).toHaveLength(2);
    expect(await fs.readFile(path.join(result.directory, "texture.jpg"), "utf8")).toBe("fixture");
    expect(await fs.readdir(classic)).toEqual(["test.milk"]);
    expect(await preparePresetPack("combined", base, [classic])).toEqual(result);
  });
  it.skipIf(process.platform !== "linux")("failed download preserves an existing damaged pack for repair and removes staging", async () => {
    const base = path.join(paths.data, "projectM"), dir = await installed(base);
    await fs.unlink(path.join(dir, "presets", "texture.jpg"));
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("corrupt"));
    try {
      await expect(installCreamPack()).rejects.toThrow("checksum");
      expect(await fs.readFile(path.join(dir, "presets", "test.milk"), "utf8")).toBe("fixture");
      expect((await fs.readdir(base)).filter(n => n.startsWith(".install-"))).toEqual([]);
    } finally { fetcher.mockRestore(); }
  });
});
