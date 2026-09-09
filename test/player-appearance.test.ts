import { describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { configFile } from "../src/config/paths";
import { defaultConfig, loadConfig, saveConfig } from "../src/config/config";
import { playerPalette, COLOR } from "../src/ui/theme";

describe("player appearance persistence", () => {
  it("requires an explicit persisted boolean to enable online lyrics", async () => {
    await fs.mkdir(path.dirname(configFile), { recursive: true });
    for (const lyricsOnline of [undefined, "true", 1, false]) {
      await fs.writeFile(configFile, JSON.stringify({ lyricsOnline }));
      expect((await loadConfig()).lyricsOnline).toBe(false);
    }
    await saveConfig({ ...defaultConfig, lyricsOnline: true });
    expect((await loadConfig()).lyricsOnline).toBe(true);
  });
  it("defaults old/invalid settings to lavender and reduced motion", async () => {
    await fs.mkdir(path.dirname(configFile), { recursive: true });
    await fs.writeFile(configFile, JSON.stringify({ playerTheme: "invalid", reducedMotion: "no" }));
    expect(await loadConfig()).toMatchObject({ playerTheme: "lavender", reducedMotion: true });
    await fs.writeFile(configFile, "{}");
    expect(await loadConfig()).toMatchObject({ playerTheme: "lavender", reducedMotion: true });
  });
  it("restores choices without changing unrelated settings or the shared palette", async () => {
    await saveConfig({ ...defaultConfig, playerTheme: "calm", reducedMotion: false, retries: 7 });
    expect(await loadConfig()).toMatchObject({ playerTheme: "calm", reducedMotion: false, retries: 7 });
    expect(playerPalette("calm").accent).not.toBe(COLOR.accent);
    expect(playerPalette("lavender").accent).toBe(COLOR.accent);
  });
});
