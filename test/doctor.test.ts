import { afterEach, expect, it, vi } from "vitest";
import { execa } from "execa";
import { installationReport } from "../src/cli/doctor";
import { promises as fs } from "node:fs";
import path from "node:path";
import { configFile } from "../src/config/paths";
import { ytDlpPath } from "../src/bin/ytdlp-fetch";
vi.mock("../src/util/exec", () => ({ findOnPath: vi.fn(async (name: string) => "/fixture/" + name) }));
vi.mock("execa", () => ({ execa: vi.fn() }));
afterEach(async () => { vi.resetAllMocks(); vi.unstubAllEnvs(); await fs.rm(configFile, { force: true }); });

it("allows bounded cold yt-dlp startup while keeping other probes short", async () => {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  vi.mocked(execa).mockResolvedValue({ stdout: "fixture version" } as never);
  const report = await installationReport();
  expect(report.ok).toBe(true);
  expect(report.toolsMode).toContain("managed");
  expect(execa).toHaveBeenCalledWith("/fixture/yt-dlp", ["--version"], { timeout: 15000 });
  expect(execa).toHaveBeenCalledWith("/fixture/ffmpeg", ["-version"], { timeout: 5000 });
});

it.each([
  [{ timedOut: true }, "Timed out after 15 seconds"],
  [{ exitCode: 1 }, "Exited with code 1"],
  [{ code: "ENOENT" }, "Could not start executable"],
])("reports the actual probe failure without exposing process output", async (failure, message) => {
  vi.mocked(execa).mockRejectedValue({ ...failure, stderr: "private diagnostic data" });
  const report = await installationReport();
  expect(report.ok).toBe(false);
  expect(report.tools.find(tool => tool.name === "yt-dlp")?.error).toBe(message);
  expect(JSON.stringify(report)).not.toContain("private diagnostic data");
});

it("reports an app-managed override separately from Homebrew's other tools", async () => {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  await fs.writeFile(configFile, JSON.stringify({ ytdlpProvider: "managed", ytdlpChannel: "nightly" }));
  vi.mocked(execa).mockResolvedValue({ stdout: "fixture version" } as never);
  const report = await installationReport();
  expect(report.ytDlpProvider).toBe("managed");
  expect(report.toolsMode).toContain("system-managed mpv/ffmpeg");
  expect(report.managedYtDlp).toMatchObject({ path: ytDlpPath(), requestedChannel: "nightly", version: "fixture version" });
});

it("does not treat a cached copy as active when system ownership is selected", async () => {
  vi.stubEnv("JUKEBOXCLI_SYSTEM_TOOLS", "1");
  vi.mocked(execa).mockImplementation(async file => {
    if (file === "/fixture/yt-dlp") throw Error("missing");
    return { stdout: "fixture version" } as never;
  });
  const report = await installationReport();
  expect(report.ok).toBe(false);
  expect(report.ytDlpProvider).toBe("system");
  expect(report.managedYtDlp).toBeUndefined();
  expect(execa).not.toHaveBeenCalledWith(ytDlpPath(), expect.anything(), expect.anything());
});
