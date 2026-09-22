import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { MAC_VISUALIZER_ASSETS, macVisualizerPaths, macVisualizerSupported, verifyVisualizerArchive } from "../src/player/macos-visualizer-install";
import { parseCliArgs } from "../src/cli/args";

describe("optional Mac visualiser", () => {
  it("is an explicit standalone install, not part of bare launch or doctor", () => {
    expect(parseCliArgs(["--install-visualizer"])).toEqual({ kind: "install-visualizer" });
    expect(parseCliArgs([])).toEqual({ kind: "run" });
    expect(parseCliArgs(["--doctor"])).toEqual({ kind: "doctor" });
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
  });
  it("requires Mac process-tap support and never enables installation on Linux", () => {
    expect(macVisualizerSupported("darwin", "23.4.0")).toBe(true);
    expect(macVisualizerSupported("darwin", "25.0.0")).toBe(true);
    expect(macVisualizerSupported("darwin", "23.3.0")).toBe(false);
    expect(macVisualizerSupported("darwin", "22.6.0")).toBe(false);
    expect(macVisualizerSupported("linux", "26.0.0")).toBe(false);
  });
  it("pins all four sources, including the evaluator submodule and textures", () => {
    expect(MAC_VISUALIZER_ASSETS.map(a => a.name)).toEqual(["projectm", "eval", "presets", "textures"]);
    for (const asset of MAC_VISUALIZER_ASSETS) {
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(asset.ref).not.toMatch(/latest|main|master/);
    }
  });
  it("keeps the app and assets together in the chosen profile, outside package-manager paths", () => {
    const p = macVisualizerPaths("/example/profile/visualizer");
    expect(p.executable).toBe("/example/profile/visualizer/current/JukeboxCli Visualizer.app/Contents/MacOS/jukeboxcli-visualizer");
    expect(p.textures).toBe("/example/profile/visualizer/current/textures/textures");
  });
  it("rejects a damaged or substituted archive before extraction", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "jukeboxcli-visualizer-test-"));
    try {
      const archive = path.join(dir, "archive");
      await fs.writeFile(archive, "fixture");
      await expect(verifyVisualizerArchive(archive, createHash("sha256").update("fixture").digest("hex"))).resolves.toBeUndefined();
      await expect(verifyVisualizerArchive(archive, "0".repeat(64))).rejects.toThrow("SHA-256");
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
});
