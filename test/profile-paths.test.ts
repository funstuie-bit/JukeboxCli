import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const fixture = vi.hoisted(() => ({ home: "" }));
vi.mock("node:os", async original => {
  const actual = await original<typeof import("node:os")>();
  return { ...actual, default: { ...actual.default, homedir: () => fixture.home } };
});
vi.mock("env-paths", () => ({ default: (name: string) => Object.fromEntries(
  ["config", "data", "cache", "log", "temp"].map(key => [key, path.join(fixture.home, name, key)])) }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
describe("fresh and legacy profiles", () => {
  async function load(existing: string[] = [], portable?: string) {
    fixture.home = mkdtempSync(path.join(tmpdir(), "jukeboxcli-paths-"));
    for (const dir of existing) mkdirSync(path.join(fixture.home, dir), { recursive: true });
    vi.stubEnv("JUKEBOXCLI_HOME", portable);
    vi.resetModules();
    return import("../src/config/paths");
  }
  it("brands truly fresh paths without creating anything", async () => {
    const p = await load();
    expect(p.paths.config).toBe(path.join(fixture.home, "JukeboxCli/config"));
    expect(p.defaultLibraryDir).toBe(path.join(fixture.home, "Music/JukeboxCli"));
    expect(existsSync(p.paths.config)).toBe(false);
  });
  it("keeps legacy config/data and the existing music folder", async () => {
    const p = await load(["soundcli/config"]);
    expect(p.paths.data).toBe(path.join(fixture.home, "soundcli/data"));
    expect(p.defaultLibraryDir).toBe(path.join(fixture.home, "Music/soundcli"));
    expect(p.legacyProfile).toBe(true);
  });
  it("prefers a branded profile when both exist, never merging them", async () => {
    const p = await load(["soundcli/config", "JukeboxCli/config"]);
    expect(p.paths.data).toBe(path.join(fixture.home, "JukeboxCli/data"));
  });
  it("retains old music even when config is absent", async () => {
    const p = await load(["Music/soundcli"]); expect(p.legacyProfile).toBe(true);
  });
  it("portable override wins over both profiles", async () => {
    const isolated = mkdtempSync(path.join(tmpdir(), "jukeboxcli-portable-"));
    const p = await load(["soundcli/config", "JukeboxCli/config"], isolated);
    expect(p.paths.data).toBe(path.join(isolated, "data")); expect(p.defaultLibraryDir).toBe(path.join(isolated, "music"));
  });
});
