import { describe, expect, it, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { ConfigSession } from "../src/config/session";
import { defaultConfig, loadConfig, saveConfig, stripDeprecatedConfig, type Config } from "../src/config/config";
import { configFile, paths } from "../src/config/paths";
import { parseCliArgs } from "../src/cli/args";

const baseline = (): Config => stripDeprecatedConfig({ ...defaultConfig, firstRunComplete: true,
  libraryDir: path.join(paths.data, "saved-music"), audioFormat: "best" });

describe("launch-only config", () => {
  it("uses every CLI override without changing the saved file or the next launch", async () => {
    const saved = baseline();
    await saveConfig(saved);
    const before = await fs.readFile(configFile, "utf8");
    const command = parseCliArgs(["--output-dir", path.join(paths.data, "temporary-output"),
      "--cookies", "/fixture/cookies.txt", "--cookies-from-browser", "firefox",
      "--format", "mp3", "--quality", "5", "--yt-format", "bestaudio",
      "--output-template", "%(title)s.%(ext)s", "--sleep", "2", "--max-sleep", "6",
      "--retries", "3", "--reencode", "true", "https://example.com/track"]);
    if (command.kind !== "run") throw Error("Expected run");
    const session = new ConfigSession(await loadConfig(), command.overrides);
    expect(session.get()).toMatchObject(command.overrides!);
    await session.save(session.get()); // startup must not persist the merged values
    expect(await fs.readFile(configFile, "utf8")).toBe(before);
    expect(new ConfigSession(await loadConfig()).get()).toMatchObject(saved);
  });

  it("saves onboarding and unrelated settings without leaking temporary values", async () => {
    const saved = { ...baseline(), firstRunComplete: false };
    await saveConfig(saved);
    const session = new ConfigSession(await loadConfig(), {
      libraryDir: "/fixture/temporary", audioFormat: "mp3", cookiesFile: "/fixture/private-cookie-file",
    });
    await session.save({ ...session.get(), firstRunComplete: true });
    await session.save({ ...session.get(), playerTheme: "calm", lyricsOnline: true });
    const disk = await loadConfig();
    expect(disk).toMatchObject({ ...saved, firstRunComplete: true, playerTheme: "calm", lyricsOnline: true });
    expect(disk.cookiesFile).toBeUndefined();
    expect(session.get()).toMatchObject({ audioFormat: "mp3", libraryDir: "/fixture/temporary" });
  });

  it("persists a deliberate edit to an overridden field and supports clearing it", async () => {
    await saveConfig({ ...baseline(), cookiesFile: "/fixture/saved-cookies" });
    const session = new ConfigSession(await loadConfig(), { audioFormat: "mp3", cookiesFile: "/fixture/temporary-cookies" });
    await session.save({ ...session.get(), audioFormat: "opus", cookiesFile: undefined });
    expect(await loadConfig()).toMatchObject({ audioFormat: "opus" });
    expect((await loadConfig()).cookiesFile).toBeUndefined();
    expect(session.get().audioFormat).toBe("opus");
  });

  it("does not create config for a fresh launch until preferences change", async () => {
    await fs.rm(configFile, { force: true });
    const session = new ConfigSession(await loadConfig(), { audioFormat: "mp3" });
    await session.save(session.get());
    await expect(fs.stat(configFile)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("serializes writes and can retry after a failed save", async () => {
    let release!: () => void;
    const persist = vi.fn().mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }))
      .mockRejectedValueOnce(Error("fixture write failure")).mockResolvedValue(undefined);
    const session = new ConfigSession(baseline(), { audioFormat: "mp3" }, persist);
    const first = session.save({ ...session.get(), lyricsOnline: true });
    const second = session.save({ ...session.get(), playerTheme: "calm" });
    const rejected = expect(second).rejects.toThrow("fixture write failure");
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));
    release(); await first; await rejected;
    await session.save({ ...session.get(), reducedMotion: false });
    expect(persist.mock.calls[2]![0]).toMatchObject({ audioFormat: "best", lyricsOnline: true, playerTheme: "calm", reducedMotion: false });
  });
});
